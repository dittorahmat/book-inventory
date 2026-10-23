import { eq } from "drizzle-orm";
import { auth } from "../auth";
import type { AppDatabase } from "../../db";
import { purchaseOrders, schools, studentBookOrders, transferShipments } from "../../db/schema";

export type StaffRole = 
  | "central_admin" 
  | "warehouse_admin" 
  | "warehouse_books_admin" 
  | "warehouse_uniforms_admin" 
  | "school_admin" 
  | "branch_admin";

export const STAFF_ROLES: StaffRole[] = [
  "central_admin", 
  "warehouse_admin", 
  "warehouse_books_admin", 
  "warehouse_uniforms_admin", 
  "school_admin", 
  "branch_admin"
];

/** Logistics managers: allowed to run procurement and package-master mutations. */
export const LOGISTICS_ROLES: StaffRole[] = [
  "central_admin", 
  "warehouse_admin", 
  "warehouse_books_admin", 
  "warehouse_uniforms_admin"
];

export interface AccessActor {
  role: StaffRole;
  schoolId: string | null;
}

export class AccessHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as string[]).includes(value);
}

/** Resolve the authenticated staff actor from request headers. Null = unauthenticated (legacy open access). */
export async function resolveRequestActor(c: {
  req: { raw: { headers: Headers } };
}): Promise<AccessActor | null> {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const user = session?.user as unknown as { role?: unknown; schoolId?: unknown } | undefined;
    if (user && isStaffRole(user.role)) {
      return {
        role: user.role,
        schoolId: typeof user.schoolId === "string" ? user.schoolId : null,
      };
    }
  } catch {
    // No usable session: treat as unauthenticated.
  }
  return null;
}

const mustExist = (ids: string[], id: string): void => {
  if (!ids.includes(id)) throw new AccessHttpError(404, "Sekolah/gudang tidak ditemukan");
};

/**
 * Pure location-scope resolution. Central admin & warehouse roles see all (or one requested);
 * school/branch roles are locked to their own school location.
 * Null actor preserves legacy open access for unauthenticated callers.
 */
export function resolveLocationScope(
  actor: AccessActor | null,
  requestedSchoolId: string | undefined,
  allSchools: Array<{ id: string }>
): string[] {
  const ids = allSchools.map((s) => s.id);
  const isGlobal = !actor || actor.role === "central_admin" || LOGISTICS_ROLES.includes(actor.role);
  if (isGlobal) {
    if (requestedSchoolId) {
      mustExist(ids, requestedSchoolId);
      return [requestedSchoolId];
    }
    return ids;
  }
  if (!actor.schoolId) {
    throw new AccessHttpError(403, "Admin terisolasi belum memiliki penugasan sekolah/gudang");
  }
  if (requestedSchoolId && requestedSchoolId !== actor.schoolId) {
    throw new AccessHttpError(403, "Akses ke sekolah/gudang lain dilarang");
  }
  return [actor.schoolId];
}

/** Throw unless the actor may act on the given location. Null actor = legacy allow. Central & warehouse can roam. */
export function assertLocationAllowed(
  actor: AccessActor | null,
  locationId: string,
  allSchools: Array<{ id: string }>
): void {
  mustExist(allSchools.map((s) => s.id), locationId);
  if (!actor || actor.role === "central_admin" || LOGISTICS_ROLES.includes(actor.role)) return;
  if (!actor.schoolId) {
    throw new AccessHttpError(403, "Admin terisolasi belum memiliki penugasan sekolah/gudang");
  }
  if (actor.schoolId !== locationId) {
    throw new AccessHttpError(403, "Aksi di luar sekolah/gudang penugasan dilarang");
  }
}

/** Throw 401 unless a staff session is present. Opt-in per route (later tickets). */
export function requireAuthenticatedActor(actor: AccessActor | null): AccessActor {
  if (!actor) throw new AccessHttpError(401, "Sesi login wajib untuk mengakses fitur ini");
  return actor;
}

/** Throw 401 for anonymous callers, 403 for non-central roles. Opt-in per route (later tickets). */
export function requireCentralAdmin(actor: AccessActor | null): AccessActor {
  if (!actor) throw new AccessHttpError(401, "Sesi login wajib untuk mengakses fitur ini");
  if (actor.role !== "central_admin") throw new AccessHttpError(403, "Hanya admin pusat yang dapat mengakses fitur ini");
  return actor;
}

/** Throw unless the actor holds a logistics role. Null actor = legacy allow. */
export function requireLogisticsRole(actor: AccessActor | null): void {
  if (!actor) return;
  if (!LOGISTICS_ROLES.includes(actor.role)) {
    throw new AccessHttpError(403, "Hanya central admin atau admin gudang yang dapat mengelola pengadaan");
  }
}

/**
 * Resolve + authenticate + authorize logistics in one call. Prefer this over
 * chaining the three guards verbatim: passing the nullable resolve result
 * straight into requireLogisticsRole silently allows anonymous callers.
 */
export async function resolveLogisticsActor(c: {
  req: { raw: { headers: Headers } };
}): Promise<AccessActor> {
  const actor = requireAuthenticatedActor(await resolveRequestActor(c));
  requireLogisticsRole(actor);
  return actor;
}

/** Map an AccessHttpError to a JSON response; rethrow anything else. */
export function accessErrorResponse(c: { json: (body: unknown, status?: 400 | 401 | 403 | 404) => Response }, err: unknown) {
  if (err instanceof AccessHttpError) {
    return c.json({ success: false, message: err.message }, err.status as 400 | 401 | 403 | 404);
  }
  throw err;
}

/** Load all location ids for scoping. Keeps route handlers to one-liners. */
export const loadLocationIds = (database: AppDatabase): Promise<Array<{ id: string }>> =>
  database.select({ id: schools.id }).from(schools);

/**
 * Gabungan resolve + authenticate + scope dalam satu panggilan: menggantikan
 * tarian 3 langkah `resolveRequestActor → requireAuthenticatedActor →
 * loadLocationIds → resolveLocationScope` di setiap route.
 */
export async function requireScopedActor(
  database: Parameters<typeof loadLocationIds>[0],
  c: Parameters<typeof resolveRequestActor>[0] & { req: { query: (name: string) => string | undefined } },
  requestedSchoolId?: string
): Promise<{ actor: AccessActor; locations: Array<{ id: string }>; scope: string[] }> {
  const actor = requireAuthenticatedActor(await resolveRequestActor(c));
  const locations = await loadLocationIds(database);
  return { actor, locations, scope: resolveLocationScope(actor, requestedSchoolId, locations) };
}

/**
 * Gabungan resolve + authenticate + authorize logistik + scope dalam satu
 * panggilan untuk route pengadaan: sama seperti requireScopedActor ditambah
 * penegakan peran logistik (pesan kanonik dipakai ulang).
 */
export async function requireScopedLogisticsActor(
  database: Parameters<typeof loadLocationIds>[0],
  c: Parameters<typeof resolveRequestActor>[0] & { req: { query: (name: string) => string | undefined } },
  requestedSchoolId?: string
): Promise<{ actor: AccessActor; locations: Array<{ id: string }>; scope: string[] }> {
  const scoped = await requireScopedActor(database, c, requestedSchoolId);
  requireLogisticsRole(scoped.actor);
  return scoped;
}
/**
 * Satu-satunya pemilik aturan visibilitas Transfer Shipment: central melihat
 * semua; peran terisolasi hanya sisi asal/tujuan. Menggantikan cek
 * `actor.role !== "central_admin"` inline di route.
 */
export function assertShipmentVisible(
  actor: AccessActor,
  fromSchoolId: string,
  toSchoolId?: string,
  action = "Akses ke transfer lokasi lain dilarang"
): void {
  if (actor.role === "central_admin") return;
  if (!actor.schoolId || (actor.schoolId !== fromSchoolId && (!toSchoolId || actor.schoolId !== toSchoolId))) {
    throw new AccessHttpError(403, action);
  }
}

export type ScopedOrderRow = typeof studentBookOrders.$inferSelect;

export type LoadScopedOrderResult =
  | { ok: true; order: ScopedOrderRow }
  | { ok: false; status: 403 | 404; message: string };

/**
 * Ambil satu Student Order sekaligus gerbang lokasinya dalam satu seam:
 * menggantikan tarian `select order → 404 → assertLocationAllowed` yang
 * diulang tiap handler mutasi. Null actor = legacy allow seperti
 * assertLocationAllowed.
 */
export const loadScopedOrder = async (
  database: AppDatabase,
  actor: AccessActor | null,
  locations: Array<{ id: string }>,
  orderId: string
): Promise<LoadScopedOrderResult> => {
  const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  if (!order) return { ok: false, status: 404, message: "Pesanan tidak ditemukan" };
  try {
    assertLocationAllowed(actor, order.schoolId, locations);
  } catch (err) {
    if (err instanceof AccessHttpError) return { ok: false, status: err.status as 403 | 404, message: err.message };
    throw err;
  }
  return { ok: true, order };
};

export type ScopedPoRow = typeof purchaseOrders.$inferSelect;

export type LoadScopedPoResult =
  | { ok: true; po: ScopedPoRow }
  | { ok: false; status: 403 | 404; message: string };

/**
 * Ambil satu Purchase Order sekaligus gerbang lokasi targetnya dalam satu seam:
 * menggantikan tarian `select PO → 404 → assertLocationAllowed` yang diulang
 * tiap handler pengadaan. Null actor = legacy allow seperti assertLocationAllowed.
 */
export const loadScopedPo = async (
  database: AppDatabase,
  actor: AccessActor | null,
  locations: Array<{ id: string }>,
  poId: string
): Promise<LoadScopedPoResult> => {
  const [po] = await database.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) return { ok: false, status: 404, message: "Purchase Order tidak ditemukan" };
  try {
    assertLocationAllowed(actor, po.targetSchoolId, locations);
  } catch (err) {
    if (err instanceof AccessHttpError) return { ok: false, status: err.status as 403 | 404, message: err.message };
    throw err;
  }
  return { ok: true, po };
};

export type ScopedShipmentRow = typeof transferShipments.$inferSelect;

export type LoadScopedShipmentResult =
  | { ok: true; shipment: ScopedShipmentRow }
  | { ok: false; status: 403 | 404; message: string };

/**
 * Ambil satu Transfer Shipment sekaligus gerbang visibilitasnya dalam satu seam:
 * menggantikan tarian `select shipment → 404 → assertShipmentVisible`. `action`
 * opsional mewarisi pesan kustom DELETE (lihat assertShipmentVisible).
 */
export const loadScopedShipment = async (
  database: AppDatabase,
  actor: AccessActor,
  shipmentId: string,
  action?: string
): Promise<LoadScopedShipmentResult> => {
  const [shipment] = await database.select().from(transferShipments).where(eq(transferShipments.id, shipmentId));
  if (!shipment) return { ok: false, status: 404, message: "Shipment not found" };
  try {
    if (action) assertShipmentVisible(actor, shipment.fromSchoolId, undefined, action);
    else assertShipmentVisible(actor, shipment.fromSchoolId, shipment.toSchoolId);
  } catch (err) {
    if (err instanceof AccessHttpError) return { ok: false, status: err.status as 403 | 404, message: err.message };
    throw err;
  }
  return { ok: true, shipment };
};
