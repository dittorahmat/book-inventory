import { auth } from "../auth";
import type { StaffRole } from "../services/access-scope";

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

const realGetSession = auth.api.getSession;

/**
 * Stub sesi staf untuk test route (pengganti tiruan `(auth.api as any)`).
 * mockActor("central_admin") / mockActor("school_admin", "school-alw-1") / mockActor(null).
 */
export function mockActor(role: StaffRole | null, schoolId: string | null = null): void {
  const stub = (role ? { user: { id: "u-test", role, schoolId } } : null) as unknown as SessionResult;
  auth.api.getSession = (async () => stub) as typeof auth.api.getSession;
}

export function restoreActor(): void {
  auth.api.getSession = realGetSession;
}
