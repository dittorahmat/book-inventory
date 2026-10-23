import {
  BarChart3,
  BookOpen,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Package,
  RotateCcw,
  Scale,
  Settings,
  Shirt,
  ShoppingBag,
  Users,
  Warehouse,
} from "lucide-react";
import type { ComponentType } from "react";
import {
  isBookWarehouseStaffRole,
  isCentralRole,
  isSchoolRole,
  isUniformStaffRole,
  type StaffRole,
} from "../../lib/staff-roles";

/**
 * Satu-satunya sumber daftar tab staf (id, label per role, ikon, dan
 * kelayakan). Komponen hanya merender; daftar ini data-driven agar bisa diuji
 * (`staff-tabs.test.ts`) — tab baru wajib menambah entry di sini + test.
 */
export const TAB_IDS = [
  "dashboard",
  "catalog",
  "packages",
  "inventory",
  "students",
  "student_orders",
  "uniforms",
  "procurement",
  "internal_orders",
  "returns",
  "reconciliation",
  "reports",
  "settings",
] as const;

export type ActiveTab = typeof TAB_IDS[number];

export interface DesktopTabItem {
  id: ActiveTab;
  label: (role: StaffRole) => string;
  icon: ComponentType<{ className?: string }>;
  visible: (role: StaffRole) => boolean;
}

export const DESKTOP_TABS: DesktopTabItem[] = [
  {
    id: "dashboard",
    label: () => "Dashboard",
    icon: LayoutDashboard,
    visible: (r) => isCentralRole(r) || r === "warehouse_admin",
  },
  {
    id: "internal_orders",
    label: (r) => (isSchoolRole(r) ? "Pesan ke Gudang" : "Pesanan dari Cabang"),
    icon: Warehouse,
    visible: (r) => isSchoolRole(r) || isBookWarehouseStaffRole(r),
  },
  {
    id: "students",
    label: () => "Data Siswa",
    icon: GraduationCap,
    visible: (r) => isSchoolRole(r) || isCentralRole(r) || isBookWarehouseStaffRole(r),
  },
  {
    id: "uniforms",
    label: () => "Gudang Seragam",
    icon: Shirt,
    visible: (r) => isUniformStaffRole(r),
  },
  {
    id: "student_orders",
    label: () => "Pesanan Siswa",
    icon: Users,
    visible: (r) => isCentralRole(r) || isBookWarehouseStaffRole(r) || isSchoolRole(r),
  },
  {
    id: "packages",
    label: () => "Paket & Rakit",
    icon: Package,
    visible: (r) => isCentralRole(r) || isBookWarehouseStaffRole(r),
  },
  {
    id: "procurement",
    label: () => "PO Supplier",
    icon: ShoppingBag,
    visible: (r) => isCentralRole(r) || isBookWarehouseStaffRole(r),
  },
  {
    id: "returns",
    label: () => "Refund Buku",
    icon: RotateCcw,
    visible: (r) => isCentralRole(r) || isBookWarehouseStaffRole(r),
  },
  {
    id: "inventory",
    label: () => "Stok Satuan",
    icon: Layers,
    visible: (r) => isCentralRole(r) || isBookWarehouseStaffRole(r),
  },
  {
    id: "catalog",
    label: () => "Katalog",
    icon: BookOpen,
    visible: (r) => isCentralRole(r) || isBookWarehouseStaffRole(r),
  },
  {
    id: "reconciliation",
    label: () => "Rekonsiliasi",
    icon: Scale,
    visible: (r) => isCentralRole(r) || isBookWarehouseStaffRole(r),
  },
  {
    id: "reports",
    label: () => "Laporan",
    icon: BarChart3,
    visible: (r) => isCentralRole(r) || isBookWarehouseStaffRole(r),
  },
  {
    id: "settings",
    label: () => "Pengaturan",
    icon: Settings,
    visible: (r) => isCentralRole(r),
  },
];

export const getVisibleTabsForRole = (role: StaffRole): ActiveTab[] =>
  DESKTOP_TABS.filter((tab) => tab.visible(role)).map((tab) => tab.id);
