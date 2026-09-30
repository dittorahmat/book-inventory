import { auth } from "../auth";

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

function allIdsOf(allSchools: Array<{ id: string }>): string[] {
  return allSchools.map((s) => s.id);
}

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
  const ids = allIdsOf(allSchools);
  if (!actor || actor.role === "central_admin") {
    if (requestedSchoolId) {
      if (!ids.includes(requestedSchoolId)) {
        throw new AccessHttpError(404, "Sekolah/gudang tidak ditemukan");
      }
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
  const ids = allIdsOf(allSchools);
  if (!ids.includes(locationId)) {
    throw new AccessHttpError(404, "Sekolah/gudang tidak ditemukan");
  }
  if (!actor || actor.role === "central_admin") return;
  if (!actor.schoolId) {
    throw new AccessHttpError(403, "Admin terisolasi belum memiliki penugasan sekolah/gudang");
  }
  if (actor.schoolId !== locationId) {
    throw new AccessHttpError(403, "Aksi di luar sekolah/gudang penugasan dilarang");
  }
}

/** Throw unless the actor holds a logistics role. Null actor = legacy allow. */
export function requireLogisticsRole(actor: AccessActor | null): void {
  if (!actor) return;
  if (!LOGISTICS_ROLES.includes(actor.role)) {
    throw new AccessHttpError(403, "Hanya central admin atau admin gudang yang dapat mengelola pengadaan");
  }
}

/** Map an AccessHttpError to a JSON response; rethrow anything else. */
export function accessErrorResponse(c: { json: (body: unknown, status?: 400 | 403 | 404) => Response }, err: unknown) {
  if (err instanceof AccessHttpError) {
    return c.json({ success: false, message: err.message }, err.status as 400 | 403 | 404);
  }
  throw err;
}

/** Load all location ids for scoping. Keeps route handlers to one-liners. */
export async function loadLocationIds(database: {
  select: (fields?: unknown) => { from: (table: unknown) => Promise<Array<{ id: string }>> };
}): Promise<Array<{ id: string }>> {
  const { schools } = await import("../../db/schema");
  return database.select({ id: schools.id }).from(schools);
}
