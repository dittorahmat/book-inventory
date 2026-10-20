import type { StaffRole } from "../server/services/access-scope";

export type { StaffRole };

/** Admin pusat: satu-satunya peran yang boleh memicu seed demo & kelola kredensial. */
export const isCentralRole = (role: StaffRole | undefined): boolean => role === "central_admin";

/** Peran logistik (pusat + gudang): boleh mutasi master, PO, dan paket. */
export const isLogisticsRole = (role: StaffRole | undefined): boolean =>
  role === "central_admin" || 
  role === "warehouse_admin" || 
  role === "warehouse_books_admin" || 
  role === "warehouse_uniforms_admin";

/** Hanya admin gudang seragam atau admin pusat/umum */
export const isUniformStaffRole = (role: StaffRole | undefined): boolean =>
  role === "central_admin" || 
  role === "warehouse_admin" || 
  role === "warehouse_uniforms_admin";

/** Hanya admin gudang buku atau admin pusat/umum */
export const isBookWarehouseStaffRole = (role: StaffRole | undefined): boolean =>
  role === "central_admin" || 
  role === "warehouse_admin" || 
  role === "warehouse_books_admin";

/** Peran sekolah/cabang: terisolasi ke lokasi penugasan masing-masing. */
export const isSchoolRole = (role: StaffRole | undefined): boolean =>
  role === "school_admin" || role === "branch_admin";
