import { Download, X } from "lucide-react";
import type { ExecutiveBranchStockBreakdown } from "../../lib/dashboard-types";
import { formatRupiah } from "../../lib/transfer-pricing";

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
  if (!isOpen) return null;

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

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `breakdown_stok_${academicYear.replace(/[/\\:]/g, "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 flex justify-end transition-opacity">
      <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header Drawer */}
        <div className="p-5 border-b border-[#E4E6EB] flex items-center justify-between bg-[#F7F8FA]">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#1877F2]">Breakdown Inventori & Valuasi</div>
            <h2 className="text-lg font-black text-[#050505] mt-0.5">Saldo Stok Fisik & Nilai Aset per Lokasi</h2>
            <div className="text-xs text-[#65676B]">Tahun Ajaran: {academicYear}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1877F2] bg-white border border-[#CED0D4] rounded-xl hover:bg-[#F0F2F5] transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Unduh CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup drawer"
              className="p-1.5 rounded-lg text-[#65676B] hover:bg-[#E4E6EB] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Ringkasan Makro */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-[#F0F2F5]/50 border-b border-[#E4E6EB]">
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
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-5">
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
        </div>
      </div>
    </div>
  );
}
