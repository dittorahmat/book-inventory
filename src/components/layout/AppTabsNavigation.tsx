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
  Truck,
  BarChart3,
  Settings,
} from "lucide-react";

export const TAB_IDS = [
  "dashboard",
  "catalog",
  "packages",
  "inventory",
  "students",
  "student_orders",
  "procurement",
  "internal_orders",
  "returns",
  "transfers",
  "reports",
  "settings",
] as const;

export type ActiveTab = typeof TAB_IDS[number];

export type StaffRole = "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin";

const isLogisticsRole = (role: StaffRole): boolean =>
  role === "central_admin" || role === "warehouse_admin";

interface AppTabsNavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  role: StaffRole;
}

const DESKTOP_TABS: Array<{ id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }>; requireCentral?: boolean; requireLogistics?: boolean }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "students", label: "Database Siswa", icon: GraduationCap },
  { id: "student_orders", label: "Pesanan Siswa", icon: Users },
  { id: "packages", label: "Paket & Bundling", icon: Package },
  { id: "procurement", label: "Pengadaan PO", icon: ShoppingBag, requireLogistics: true },
  { id: "internal_orders", label: "Pesan ke Gudang", icon: Warehouse },
  { id: "returns", label: "Retur Buku", icon: RotateCcw },
  { id: "inventory", label: "Stok Satuan", icon: Layers },
  { id: "catalog", label: "Katalog", icon: BookOpen },
  { id: "transfers", label: "Transfer", icon: Truck },
  { id: "reports", label: "Laporan", icon: BarChart3 },
  { id: "settings", label: "Pengaturan", icon: Settings, requireCentral: true },
];

export function AppTabsNavigation({
  activeTab,
  onSelectTab,
  role,
}: AppTabsNavigationProps) {
  return (
    <div className="bg-white border-b border-[#E4E6EB]">
      <div className="hidden md:flex max-w-6xl mx-auto px-6 gap-1 text-sm overflow-x-auto">
        {DESKTOP_TABS.filter(
          (tab) =>
            (!tab.requireCentral || role === "central_admin") &&
            (!tab.requireLogistics || isLogisticsRole(role))
        ).map((tab) => {
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
              {tab.label}
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
      <div className="grid grid-cols-6 auto-cols-fr gap-1.5">
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
          <span className="text-[11px] font-semibold">Inventory</span>
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
          <span className="text-[11px] font-semibold">Catalog</span>
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
          onClick={() => onSelectTab("transfers")}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
            activeTab === "transfers"
              ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
              : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
          }`}
        >
          <Truck className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-semibold">Transfers</span>
        </button>

        {role === "central_admin" && (
          <button
            type="button"
            onClick={() => onSelectTab("settings")}
            className={`col-span-6 sm:col-span-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors active:scale-[0.98] ${
              activeTab === "settings"
                ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
                : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
            }`}
          >
            <Settings className="w-5 h-5 mb-1" />
            <span className="text-[11px] font-semibold">Settings</span>
          </button>
        )}
      </div>
    </nav>
  );
}
