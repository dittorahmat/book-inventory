import { exportCsvFile } from "../../lib/csv-export";
import type { ExecutiveBranchStockBreakdown } from "../../lib/dashboard-types";
import { formatRupiah } from "../../lib/transfer-pricing";
import { ExecutiveBreakdownDrawerShell } from "./ExecutiveBreakdownDrawerShell";

interface StockBreakdownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExecutiveBranchStockBreakdown[];
  academicYear: string;
}

export function StockBreakdownDrawer({
  isOpen,
  onClose,
  data,
  academicYear,
}: StockBreakdownDrawerProps) {
  const totalValuation = data.reduce((s, r) => s + r.valuationRp, 0);
  const totalLoose = data.reduce((s, r) => s + r.looseStock, 0);
  const totalPackage = data.reduce((s, r) => s + r.packageStock, 0);
  const totalAdjustments = data.reduce((s, r) => s + r.adjustmentUnits, 0);

  const handleExportCsv = () => {
    const headers = [
      "Kode Cabang",
      "Nama Sekolah / Gudang",
      "Valuasi Nilai Buku (Rp)",
      "Stok Satuan Bebas",
      "Stok Paket Siap",
      "Selisih Susut/Opname",
    ];
    const rows = data.map((r) => [
      r.schoolCode,
      `"${r.schoolName.replace(/"/g, '""')}"`,
      String(r.valuationRp),
      String(r.looseStock),
      String(r.packageStock),
      String(r.adjustmentUnits),
    ]);
    const totalRow = [
      "TOTAL",
      "Semua Lokasi",
      String(totalValuation),
      String(totalLoose),
      String(totalPackage),
      String(totalAdjustments),
    ];
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(",")), totalRow.join(",")].join("\n");
    exportCsvFile(`breakdown_stok_${academicYear.replace(/[/\\:]/g, "-")}`, csvContent);
  };

  const metricsSummary = (
    <>
      <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
        <div className="text-[11px] font-semibold text-[#65676B] uppercase">Total Valuasi Nilai Buku</div>
        <div className="text-base font-black text-[#1877F2] mt-1">{formatRupiah(totalValuation)}</div>
      </div>
      <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
        <div className="text-[11px] font-semibold text-[#65676B] uppercase">Stok Buku Satuan Bebas</div>
        <div className="text-base font-black text-emerald-600 mt-1">{totalLoose} eks</div>
      </div>
      <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
        <div className="text-[11px] font-semibold text-[#65676B] uppercase">Stok Paket Bundel Siap</div>
        <div className="text-base font-black text-[#050505] mt-1">{totalPackage} paket</div>
      </div>
      <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
        <div className="text-[11px] font-semibold text-[#65676B] uppercase">Selisih Opname / Susut</div>
        <div className="text-base font-black text-amber-600 mt-1">{totalAdjustments} unit</div>
      </div>
    </>
  );

  return (
    <ExecutiveBreakdownDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      category="Breakdown Inventori & Valuasi"
      title="Saldo Stok Fisik & Nilai Aset per Lokasi"
      academicYear={academicYear}
      onExportCsv={handleExportCsv}
      metricsSummary={metricsSummary}
    >
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[#E4E6EB] text-[#65676B] font-bold">
            <th className="pb-3">Lokasi / Cabang / Gudang</th>
            <th className="pb-3 text-right">Valuasi (Rp)</th>
            <th className="pb-3 text-right">Stok Satuan</th>
            <th className="pb-3 text-right">Stok Paket</th>
            <th className="pb-3 text-right">Susut/Opname</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0F2F5]">
          {data.map((row) => (
            <tr key={row.schoolId} className="hover:bg-[#F7F8FA] transition">
              <td className="py-3">
                <div className="font-bold text-[#050505]">{row.schoolName}</div>
                <div className="text-[11px] text-[#8A8D91]">{row.schoolCode}</div>
              </td>
              <td className="py-3 text-right font-black text-[#1877F2]">{formatRupiah(row.valuationRp)}</td>
              <td className="py-3 text-right font-bold text-emerald-600">{row.looseStock}</td>
              <td className="py-3 text-right font-bold text-[#050505]">{row.packageStock}</td>
              <td className="py-3 text-right font-medium text-amber-600">{row.adjustmentUnits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ExecutiveBreakdownDrawerShell>
  );
}
