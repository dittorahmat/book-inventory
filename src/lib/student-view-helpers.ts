import type { School } from "../types";
import { isCentralRole, isLogisticsRole, type StaffRole } from "./staff-roles";
import { isWarehouseLocation } from "./location-helpers";

/**
 * Menentukan default school filter di tab Data Siswa.
 * Role global (central & logistics) serta staf dengan activeSchool gudang
 * selalu default ke 'all' (Semua Cabang / Sekolah).
 * Admin cabang terisolasi ke sekolahnya masing-masing.
 */
export function resolveDefaultStudentSchoolId(
  role: StaffRole | undefined,
  activeSchool: Pick<School, "id" | "type"> | null | undefined
): string {
  const isGlobalUser = isCentralRole(role) || isLogisticsRole(role);
  const isWh = isWarehouseLocation(activeSchool);
  if (isGlobalUser || isWh) {
    return "all";
  }
  return activeSchool?.id ?? "all";
}
