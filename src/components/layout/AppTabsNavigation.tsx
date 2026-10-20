import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Package,
  ShoppingBag,
  Warehouse,
  RotateCcw,
  Layers,
  BookOpen,
  BarChart3,
  Scale,
  Settings,
  Shirt,
} from "lucide-react";
import { isCentralRole, isLogisticsRole, isUniformStaffRole, isBookWarehouseStaffRole, isSchoolRole, type StaffRole } from "../../lib/staff-roles";

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

export type { StaffRole };

interface AppTabsNavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  role: StaffRole;
}

interface DesktopTabItem {
  id: ActiveTab;
  label: (role: StaffRole) => string;
  icon: React.ComponentType<{ className?: string }>;
  visible: (role: StaffRole) => boolean;
}

const DESKTOP_TABS: DesktopTabItem[] = [
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
    visible: (r) => isCentralRole(r) || isBookWarehouseStaffRole(r),
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

export function AppTabsNavigation({
  activeTab,
  onSelectTab,
  role,
}: AppTabsNavigationProps) {
  const visibleTabs = DESKTOP_TABS.filter((tab) => tab.visible(role));

  return (
    <div className="bg-white border-b border-[#E4E6EB]">
      <div className="hidden md:flex max-w-6xl mx-auto px-6 gap-1 text-sm overflow-x-auto">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`py-3 px-3.5 flex items-center gap-2 font-semibold transition-all relative shrink-0 active:scale-[0.98] ${
                isActive
                  ? "text-[#1877F2] border-b-[3px] border-[#1877F2]"
                  : "text-[#65676B] hover:bg-[#F0F2F5] rounded-lg my-1 py-2 border-b-[3px] border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label(role)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface AppMobileNavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  role: StaffRole;
}

export function AppMobileNavigation({
  activeTab,
  onSelectTab,
  role,
}: AppMobileNavigationProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E4E6EB] shadow-lg pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 px-3">
      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={() => onSelectTab("dashboard")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
            activeTab === "dashboard"
              ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
              : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-semibold">Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("inventory")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
            activeTab === "inventory"
              ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
              : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
          }`}
        >
          <Layers className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-semibold">Stok</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("packages")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
            activeTab === "packages"
              ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
              : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
          }`}
        >
          <Package className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-semibold">Paket</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("catalog")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
            activeTab === "catalog"
              ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
              : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
          }`}
        >
          <BookOpen className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-semibold">Katalog</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("students")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
            activeTab === "students"
              ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
              : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
          }`}
        >
          <GraduationCap className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-semibold">Siswa</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("internal_orders")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
            activeTab === "internal_orders"
              ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
              : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
          }`}
        >
          <Warehouse className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-semibold">{isSchoolRole(role) ? "Pesan" : "Pesanan"}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("uniforms")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
            activeTab === "uniforms"
              ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
              : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
          }`}
        >
          <Shirt className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-semibold">Seragam</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("internal_orders")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
            activeTab === "internal_orders"
              ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
              : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
          }`}
        >
          <Warehouse className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-semibold">Ke Gudang</span>
        </button>

        {isLogisticsRole(role) && (
          <button
            type="button"
            onClick={() => onSelectTab("reconciliation")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
              activeTab === "reconciliation"
                ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
                : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
            }`}
          >
            <Scale className="w-5 h-5 mb-1" />
            <span className="text-[11px] font-semibold">Rekonsiliasi</span>
          </button>
        )}

        {isCentralRole(role) && (
          <button
            type="button"
            onClick={() => onSelectTab("settings")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
              activeTab === "settings"
                ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
                : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
            }`}
          >
            <Settings className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-semibold">Pengaturan</span>
          </button>
        )}
      </div>
    </nav>
  );
}
