import { useState } from "react";
import { Shirt, Send, PackagePlus, ArrowLeftRight, BarChart3 } from "lucide-react";
import type { School } from "../types";
import { isCentralRole, isLogisticsRole, type StaffRole } from "../lib/staff-roles";
import { UniformShipmentSection } from "../components/uniform/UniformShipmentSection";
import { UniformCatalogSection } from "../components/uniform/UniformCatalogSection";
import { UniformReturnsSection } from "../components/uniform/UniformReturnsSection";
import { UniformReportSection } from "../components/uniform/UniformReportSection";

interface UniformViewProps {
  schools: School[];
  activeSchool: School | null;
  userRole: StaffRole;
  userSchoolId: string | null;
}

export function UniformView({ schools, activeSchool, userRole, userSchoolId }: UniformViewProps) {
  const isGlobal = isCentralRole(userRole) || isLogisticsRole(userRole);
  const logistics = isLogisticsRole(userRole);
  const [section, setSection] = useState<"kirim" | "katalog" | "retur" | "laporan">("kirim");
  const lockedSchoolId = isGlobal ? null : (userSchoolId ?? activeSchool?.id ?? null);

  const subTabs = [
    { id: "kirim" as const, label: "Pengiriman Seragam", icon: Send, visible: true },
    { id: "katalog" as const, label: "Katalog & PO Konveksi", icon: PackagePlus, visible: logistics },
    { id: "retur" as const, label: "Tukar & Refund", icon: ArrowLeftRight, visible: true },
    { id: "laporan" as const, label: "Laporan & Rekap", icon: BarChart3, visible: true },
  ].filter((t) => t.visible);

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

        <nav className="flex flex-wrap p-1 bg-[#F0F2F5] rounded-xl gap-1 border border-[#E4E6EB]/60">
          {subTabs.map((t) => {
            const Icon = t.icon;
            const active = section === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSection(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
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
        {section === "kirim" && <UniformShipmentSection schools={schools} lockedSchoolId={lockedSchoolId} />}
        {section === "katalog" && logistics && <UniformCatalogSection />}
        {section === "retur" && <UniformReturnsSection schools={schools} lockedSchoolId={lockedSchoolId} logistics={logistics} />}
        {section === "laporan" && <UniformReportSection schools={schools} lockedSchoolId={lockedSchoolId} logistics={logistics} />}
      </div>
    </div>
  );
}
