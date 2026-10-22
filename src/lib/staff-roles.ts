import type { StaffRole } from "../server/services/access-scope";
import type { ActiveTab } from "../components/layout/staff-tabs";

export type { StaffRole, ActiveTab };

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

/** Menentukan tab default mendarat saat pengguna pertama kali masuk atau ketika tab saat ini tidak sah. */
export const getDefaultTabForRole = (role: StaffRole | undefined): ActiveTab => {
  if (role === "warehouse_uniforms_admin") return "uniforms";
  if (role === "warehouse_books_admin" || role === "school_admin" || role === "branch_admin") {
    return "internal_orders";
  }
  return "dashboard";
};

const ROLE_BADGE_LABELS: Record<StaffRole, string> = {
  central_admin: "HQ Central Admin",
  warehouse_uniforms_admin: "Admin Gudang Seragam",
  warehouse_books_admin: "Admin Gudang Buku",
  warehouse_admin: "Admin Gudang",
  school_admin: "Branch Admin",
  branch_admin: "Branch Admin",
};

/** Menampilkan teks badge role pengguna di header aplikasi. */
export const getRoleBadgeLabel = (role: StaffRole | undefined): string =>
  (role && ROLE_BADGE_LABELS[role]) || "Staf";
