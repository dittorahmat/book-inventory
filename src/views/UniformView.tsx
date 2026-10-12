import { useState } from "react";
import { Shirt } from "lucide-react";
import type { School } from "../types";
import { isLogisticsRole, type StaffRole } from "../lib/staff-roles";
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
  const logistics = isLogisticsRole(userRole);
  const [section, setSection] = useState<"kirim" | "katalog" | "retur" | "laporan">("kirim");
  const lockedSchoolId = logistics ? (activeSchool?.id ?? null) : (userSchoolId ?? null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-[#1877F2] flex items-center justify-center text-white shrink-0">
          <Shirt className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#050505]">Seragam</h2>
          <p className="text-xs text-[#65676B]">Kain harian + olahraga · kirim ke rumah · terpisah dari buku.</p>
        </div>
      </div>

      <div className="inline-flex p-1 bg-[#E4E6EB]/70 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setSection("kirim")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${section === "kirim" ? "bg-white text-[#1877F2] shadow-xs" : "text-[#65676B] hover:text-[#050505]"}`}
        >
          Pengiriman
        </button>
        {logistics && (
          <button
            type="button"
            onClick={() => setSection("katalog")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${section === "katalog" ? "bg-white text-[#1877F2] shadow-xs" : "text-[#65676B] hover:text-[#050505]"}`}
          >
            Katalog & PO
          </button>
        )}
        <button
          type="button"
          onClick={() => setSection("retur")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${section === "retur" ? "bg-white text-[#1877F2] shadow-xs" : "text-[#65676B] hover:text-[#050505]"}`}
        >
          Tukar & Refund
        </button>
        <button
          type="button"
          onClick={() => setSection("laporan")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${section === "laporan" ? "bg-white text-[#1877F2] shadow-xs" : "text-[#65676B] hover:text-[#050505]"}`}
        >
          Laporan
        </button>
      </div>

      {section === "kirim" && <UniformShipmentSection schools={schools} lockedSchoolId={lockedSchoolId} />}
      {section === "katalog" && logistics && <UniformCatalogSection />}
      {section === "retur" && <UniformReturnsSection schools={schools} lockedSchoolId={lockedSchoolId} logistics={logistics} />}
      {section === "laporan" && <UniformReportSection schools={schools} lockedSchoolId={lockedSchoolId} logistics={logistics} />}
    </div>
  );
}
