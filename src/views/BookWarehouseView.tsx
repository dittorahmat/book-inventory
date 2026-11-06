import { useEffect, useState } from "react";
import {
  BookOpen,
  Warehouse,
  ShoppingBag,
  RotateCcw,
  Scale,
  Package,
  Layers,
} from "lucide-react";
import type { StaffShellContext } from "../components/layout/staff-tab-views";
import { SegmentedSubNav, type SegmentedSubNavItem } from "../components/ui/SegmentedSubNav";
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

const SUB_TABS: readonly SegmentedSubNavItem<BookWarehouseSubSection>[] = [
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

  useEffect(() => {
    setActiveSection(defaultSection);
  }, [defaultSection]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E4E6EB] shadow-2xs">
        <div className="flex items-center gap-3 shrink-0">
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

        <SegmentedSubNav items={SUB_TABS} activeId={activeSection} onChange={setActiveSection} className="w-full xl:w-auto" />
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
        {activeSection === "packages" && (
          <PackagesView activeSchool={context.activeSchool} schools={context.schools} userRole={context.userRole} />
        )}
        {activeSection === "inventory" && <InventoryView activeSchool={context.activeSchool} />}
        {activeSection === "catalog" && <CatalogView userRole={context.userRole} />}
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
