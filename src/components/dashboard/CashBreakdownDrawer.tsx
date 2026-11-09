import { Download, X } from "lucide-react";
import type { ExecutiveBranchCashBreakdown } from "../../lib/dashboard-types";
import { formatRupiah } from "../../lib/transfer-pricing";

interface CashBreakdownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExecutiveBranchCashBreakdown[];
  academicYear: string;
}

export function CashBreakdownDrawer({
  isOpen,
  onClose,
  data,
  academicYear,
}: CashBreakdownDrawerProps) {
  if (!isOpen) return null;

  const totalRealized = data.reduce((s, r) => s + r.realizedRp, 0);
  const totalOutstanding = data.reduce((s, r) => s + r.outstandingRp, 0);
  const totalPaidCount = data.reduce((s, r) => s + r.paidCount, 0);
  const totalUnpaidCount = data.reduce((s, r) => s + r.unpaidCount, 0);

  const handleExportCsv = () => {
    const headers = ["Kode Cabang", "Nama Sekolah", "Kas Masuk (Rp)", "Piutang (Rp)", "Pesanan Lunas", "Pesanan Belum Lunas"];
    const rows = data.map((r) => [
      r.schoolCode,
      `"${r.schoolName.replace(/"/g, '""')}"`,
      String(r.realizedRp),
      String(r.outstandingRp),
      String(r.paidCount),
      String(r.unpaidCount),
    ]);
    const totalRow = ["TOTAL", "Semua Cabang", String(totalRealized), String(totalOutstanding), String(totalPaidCount), String(totalUnpaidCount)];
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(",")), totalRow.join(",")].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `breakdown_kas_${academicYear.replace(/[/\\:]/g, "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 flex justify-end transition-opacity">
      <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header Drawer */}
        <div className="p-5 border-b border-[#E4E6EB] flex items-center justify-between bg-[#F7F8FA]">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#1877F2]">Breakdown Keuangan</div>
            <h2 className="text-lg font-black text-[#050505] mt-0.5">Arus Kas Masuk & Piutang per Cabang</h2>
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

        {/* 4 Pilar Kas Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-[#F0F2F5]/50 border-b border-[#E4E6EB]">
          <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
            <div className="text-[11px] font-semibold text-[#65676B] uppercase">Total Realized Cash</div>
            <div className="text-base font-black text-emerald-600 mt-1">{formatRupiah(totalRealized)}</div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
            <div className="text-[11px] font-semibold text-[#65676B] uppercase">Total Piutang (Due - Paid)</div>
            <div className="text-base font-black text-amber-600 mt-1">{formatRupiah(totalOutstanding)}</div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
            <div className="text-[11px] font-semibold text-[#65676B] uppercase">Pesanan Lunas</div>
            <div className="text-base font-black text-[#050505] mt-1">{totalPaidCount} pesanan</div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
            <div className="text-[11px] font-semibold text-[#65676B] uppercase">Belum Lunas</div>
            <div className="text-base font-black text-rose-600 mt-1">{totalUnpaidCount} pesanan</div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E6EB] text-[#65676B] font-bold">
                <th className="pb-3">Sekolah / Cabang</th>
                <th className="pb-3 text-right">Kas Masuk (Rp)</th>
                <th className="pb-3 text-right">Piutang (Rp)</th>
                <th className="pb-3 text-center">Status Bayar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F5]">
              {data.map((row) => (
                <tr key={row.schoolId} className="hover:bg-[#F7F8FA] transition">
                  <td className="py-3">
                    <div className="font-bold text-[#050505]">{row.schoolName}</div>
                    <div className="text-[11px] text-[#8A8D91]">{row.schoolCode}</div>
                  </td>
                  <td className="py-3 text-right font-bold text-emerald-600">
                    {formatRupiah(row.realizedRp)}
                  </td>
                  <td className="py-3 text-right font-bold text-amber-600">
                    {formatRupiah(row.outstandingRp)}
                  </td>
                  <td className="py-3 text-center">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#E4E6EB] text-[#050505] font-semibold">
                      {row.paidCount} L / {row.unpaidCount} BL
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
