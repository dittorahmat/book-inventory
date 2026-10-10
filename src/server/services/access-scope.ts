import { auth } from "../auth";
import { schools } from "../../db/schema";

export type StaffRole = "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin";

export const STAFF_ROLES: StaffRole[] = ["central_admin", "warehouse_admin", "school_admin", "branch_admin"];

/** Logistics managers: allowed to run procurement and package-master mutations. */
export const LOGISTICS_ROLES: StaffRole[] = ["central_admin", "warehouse_admin"];

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
 * Pure location-scope resolution. Central admin sees all (or one requested);
 * scoped roles (warehouse/school/branch) are locked to their own location.
 * Null actor preserves legacy open access for unauthenticated callers.
 */
export function resolveLocationScope(
  actor: AccessActor | null,
  requestedSchoolId: string | undefined,
  allSchools: Array<{ id: string }>
): string[] {
  const ids = allSchools.map((s) => s.id);
  if (!actor || actor.role === "central_admin") {
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

/** Throw unless the actor may act on the given location. Null actor = legacy allow. */
export function assertLocationAllowed(
  actor: AccessActor | null,
  locationId: string,
  allSchools: Array<{ id: string }>
): void {
  mustExist(allSchools.map((s) => s.id), locationId);
  if (!actor || actor.role === "central_admin") return;
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
export const loadLocationIds = (database: {
  select: (fields?: unknown) => { from: (table: unknown) => Promise<Array<{ id: string }>> };
}): Promise<Array<{ id: string }>> => database.select({ id: schools.id }).from(schools);

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
