import type { StaffRole } from "../server/services/access-scope";

export type { StaffRole };

/** Admin pusat: satu-satunya peran yang boleh memicu seed demo & kelola kredensial. */
export const isCentralRole = (role: StaffRole | undefined): boolean => role === "central_admin";

/** Peran logistik (pusat + gudang): boleh mutasi master, PO, dan paket. */
export const isLogisticsRole = (role: StaffRole | undefined): boolean =>
  role === "central_admin" || role === "warehouse_admin";

/** Peran sekolah/cabang: terisolasi ke lokasi penugasan masing-masing. */
export const isSchoolRole = (role: StaffRole | undefined): boolean =>
  role === "school_admin" || role === "branch_admin";
