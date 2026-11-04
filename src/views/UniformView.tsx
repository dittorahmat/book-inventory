import { useState } from "react";
import {
  Shirt,
  Send,
  BookOpen,
  Package,
  ShoppingBag,
  ArrowLeftRight,
  BarChart3,
} from "lucide-react";
import type { School } from "../types";
import { isCentralRole, isLogisticsRole, type StaffRole } from "../lib/staff-roles";
import { SegmentedSubNav, type SegmentedSubNavItem } from "../components/ui/SegmentedSubNav";
import { UniformShipmentSection } from "../components/uniform/UniformShipmentSection";
import { UniformCatalogSection } from "../components/uniform/UniformCatalogSection";
import { UniformAssemblySection } from "../components/uniform/UniformAssemblySection";
import { UniformProcurementSection } from "../components/uniform/UniformProcurementSection";
import { UniformReturnsSection } from "../components/uniform/UniformReturnsSection";
import { UniformReportSection } from "../components/uniform/UniformReportSection";

interface UniformViewProps {
  schools: School[];
  activeSchool: School | null;
  userRole: StaffRole;
  userSchoolId: string | null;
}

export type UniformSubSection =
  | "kirim"
  | "katalog"
  | "packages"
  | "procurement"
  | "retur"
  | "laporan";

export function UniformView({ schools, activeSchool, userRole, userSchoolId }: UniformViewProps) {
  const isGlobal = isCentralRole(userRole) || isLogisticsRole(userRole);
  const logistics = isLogisticsRole(userRole);
  const [section, setSection] = useState<UniformSubSection>("kirim");
  const lockedSchoolId = isGlobal ? null : (userSchoolId ?? activeSchool?.id ?? null);

  const subTabs: readonly SegmentedSubNavItem<UniformSubSection>[] = [
    { id: "kirim" as const, label: "Pengiriman Seragam", icon: Send },
    ...(logistics
      ? [
          { id: "katalog" as const, label: "Katalog Seragam", icon: BookOpen },
          { id: "packages" as const, label: "Paket & Rakit Seragam", icon: Package },
          { id: "procurement" as const, label: "PO Konveksi", icon: ShoppingBag },
        ]
      : []),
    { id: "retur" as const, label: "Tukar & Refund", icon: ArrowLeftRight },
    { id: "laporan" as const, label: "Laporan & Rekap", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E4E6EB] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1877F2] to-[#145DBF] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Shirt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#050505]">Manajemen Seragam Sekolah</h2>
            <p className="text-xs text-[#65676B]">
              Kain harian & set olahraga · perakitan paket ber-BOM · pengiriman & tukar ukuran mandiri.
            </p>
          </div>
        </div>

        <SegmentedSubNav items={subTabs} activeId={section} onChange={setSection} />
      </div>

      <div>
        {section === "kirim" && <UniformShipmentSection schools={schools} lockedSchoolId={lockedSchoolId} />}
        {section === "katalog" && logistics && <UniformCatalogSection />}
        {section === "packages" && logistics && <UniformAssemblySection />}
        {section === "procurement" && logistics && <UniformProcurementSection />}
        {section === "retur" && <UniformReturnsSection schools={schools} lockedSchoolId={lockedSchoolId} logistics={logistics} />}
        {section === "laporan" && <UniformReportSection schools={schools} lockedSchoolId={lockedSchoolId} logistics={logistics} />}
      </div>
    </div>
  );
}
