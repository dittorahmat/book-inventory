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

/**
 * Memfilter daftar sekolah agar hanya menyertakan cabang/sekolah murid fisik
 * dan mengecualikan entitas gudang logistik.
 */
export function filterBranchSchools<T extends { type?: string }>(schools: T[]): T[] {
  return schools.filter((s) => s.type !== "warehouse");
}
