import { useState } from "react";
import {
  BookOpen,
  Warehouse,
  ShoppingBag,
  RotateCcw,
  Scale,
  Package,
  Layers,
  LucideIcon,
} from "lucide-react";
import type { StaffShellContext } from "../components/layout/staff-tab-views";
import { CatalogView } from "./CatalogView";
import { PackagesView } from "./PackagesView";
import { InventoryView } from "./InventoryView";
import { ProcurementView } from "./ProcurementView";
import { InternalProcurementView } from "./InternalProcurementView";
import { BookReturnsView } from "./BookReturnsView";
import { ReconciliationView } from "./ReconciliationView";

export type BookWarehouseSubSection =
  | "shipments"
  | "packages"
  | "inventory"
  | "catalog"
  | "procurement"
  | "returns"
  | "reconciliation";

interface SubTabItem {
  id: BookWarehouseSubSection;
  label: string;
  icon: LucideIcon;
}

const SUB_TABS: readonly SubTabItem[] = [
  { id: "shipments", label: "Kirim Ke Cabang (Surat Jalan)", icon: Warehouse },
  { id: "packages", label: "Paket & Rakit Buku", icon: Package },
  { id: "inventory", label: "Stok Satuan Gudang", icon: Layers },
  { id: "catalog", label: "Katalog Buku", icon: BookOpen },
  { id: "procurement", label: "PO Supplier (Inbound)", icon: ShoppingBag },
  { id: "returns", label: "Retur & Refund", icon: RotateCcw },
  { id: "reconciliation", label: "Rekonsiliasi / BA", icon: Scale },
] as const;

export function BookWarehouseView({
  context,
  defaultSection = "shipments",
}: {
  context: StaffShellContext;
  defaultSection?: BookWarehouseSubSection;
}) {
  const [activeSection, setActiveSection] = useState<BookWarehouseSubSection>(defaultSection);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E4E6EB] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1877F2] to-[#145DBF] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#050505]">Gudang & Logistik Buku</h2>
            <p className="text-xs text-[#65676B]">
              Manajemen stok pusat, perakitan paket, pengiriman cabang, PO supplier, retur & rekonsiliasi.
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap p-1 bg-[#F0F2F5] rounded-xl gap-1 border border-[#E4E6EB]/60">
          {SUB_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeSection === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveSection(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
                  active
                    ? "bg-white text-[#1877F2] shadow-xs"
                    : "text-[#65676B] hover:text-[#050505] hover:bg-white/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-[#1877F2]" : "text-[#65676B]"}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {activeSection === "shipments" && (
          <InternalProcurementView
            activeSchool={context.activeSchool}
            schools={context.schools}
            userRole={context.userRole}
            userSchoolId={context.userSchoolId}
          />
        )}
        {activeSection === "packages" && <PackagesView activeSchool={context.activeSchool} />}
        {activeSection === "inventory" && <InventoryView activeSchool={context.activeSchool} />}
        {activeSection === "catalog" && <CatalogView />}
        {activeSection === "procurement" && (
          <ProcurementView activeSchool={context.activeSchool} userRole={context.userRole} />
        )}
        {activeSection === "returns" && <BookReturnsView activeSchool={context.activeSchool} />}
        {activeSection === "reconciliation" && (
          <ReconciliationView
            activeSchool={context.activeSchool}
            schools={context.schools}
            isCentralAdmin={context.isCentralAdmin}
          />
        )}
      </div>
    </div>
  );
}
