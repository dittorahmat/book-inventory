import { useMemo, useState } from "react";
import type { School } from "../types";
import { isCentralRole, isLogisticsRole, type StaffRole } from "./staff-roles";

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

export interface UseRoamingLocationResult {
  isGlobalUser: boolean;
  selectedSchoolId: string;
  setSelectedSchoolId: (id: string) => void;
  effectiveSchoolId: string;
  effectiveSchool: School | null;
}

/**
 * Hook kanonik penjelajahan lokasi lintas cabang (Cross-Branch Roaming) di level view.
 * Mengunci peran cabang lokal ke activeSchool, sementara role global/logistik dapat
 * memilih cabang manapun dengan fallback default ke activeSchool.
 */
export function useRoamingLocation(
  activeSchool: School | null,
  schools: School[] = [],
  userRole?: StaffRole
): UseRoamingLocationResult {
  const isGlobalUser = isCentralRole(userRole) || isLogisticsRole(userRole);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(activeSchool?.id ?? "");
  const effectiveSchoolId = (isGlobalUser && selectedSchoolId) ? selectedSchoolId : (activeSchool?.id ?? "");

  const effectiveSchool = useMemo(() => {
    return schools.find((s) => s.id === effectiveSchoolId) || activeSchool;
  }, [schools, effectiveSchoolId, activeSchool]);

  return {
    isGlobalUser,
    selectedSchoolId,
    setSelectedSchoolId,
    effectiveSchoolId,
    effectiveSchool,
  };
}

