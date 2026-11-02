import type { School } from "../types";

/**
 * Memeriksa apakah lokasi adalah entitas Gudang Logistik (bukan cabang sekolah murid).
 */
export function isWarehouseLocation(school: Pick<School, "type"> | null | undefined): boolean {
  return school?.type === "warehouse";
}

/**
 * Memeriksa apakah lokasi adalah sekolah cabang murid.
 */
export function isBranchLocation(school: Pick<School, "type"> | null | undefined): boolean {
  return school?.type === "branch" || school?.type === "main";
}
