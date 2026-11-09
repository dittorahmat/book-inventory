import { Download, X } from "lucide-react";
import type { ExecutiveBranchOrderBreakdown } from "../../lib/dashboard-types";
import { formatRupiah } from "../../lib/transfer-pricing";

interface OrderBreakdownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExecutiveBranchOrderBreakdown[];
  academicYear: string;
}

export function OrderBreakdownDrawer({
  isOpen,
  onClose,
  data,
  academicYear,
}: OrderBreakdownDrawerProps) {
  if (!isOpen) return null;

  const totalOrders = data.reduce((s, r) => s + r.orderCount, 0);
  const totalGmv = data.reduce((s, r) => s + r.gmvRp, 0);
  const totalPackage = data.reduce((s, r) => s + r.packageCount, 0);
  const totalLoose = data.reduce((s, r) => s + r.looseCount, 0);
  const totalFulfilled = data.reduce((s, r) => s + r.fulfilledCount, 0);
  const totalWaiting = data.reduce((s, r) => s + r.waitingCount, 0);
  const avgAov = totalOrders > 0 ? Math.round(totalGmv / totalOrders) : 0;

  const handleExportCsv = () => {
    const headers = [
      "Kode Cabang",
      "Nama Sekolah",
      "Total Pesanan",
      "GMV (Rp)",
      "AOV (Rp)",
      "Paket Buku",
      "Eceran/Loose",
      "Selesai Diambil",
      "Menunggu Barang",
    ];
    const rows = data.map((r) => [
      r.schoolCode,
      `"${r.schoolName.replace(/"/g, '""')}"`,
      String(r.orderCount),
      String(r.gmvRp),
      String(r.aovRp),
      String(r.packageCount),
      String(r.looseCount),
      String(r.fulfilledCount),
      String(r.waitingCount),
    ]);
    const totalRow = [
      "TOTAL",
      "Semua Cabang",
      String(totalOrders),
      String(totalGmv),
      String(avgAov),
      String(totalPackage),
      String(totalLoose),
      String(totalFulfilled),
      String(totalWaiting),
    ];
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(",")), totalRow.join(",")].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `breakdown_pesanan_${academicYear.replace(/[/\\:]/g, "-")}.csv`);
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
            <div className="text-xs font-bold uppercase tracking-wider text-[#1877F2]">Breakdown Pesanan</div>
            <h2 className="text-lg font-black text-[#050505] mt-0.5">Volume, GMV & Bauran Produk per Cabang</h2>
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

        {/* Ringkasan Makro Kartu */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-[#F0F2F5]/50 border-b border-[#E4E6EB]">
          <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
            <div className="text-[11px] font-semibold text-[#65676B] uppercase">Total GMV</div>
            <div className="text-base font-black text-[#1877F2] mt-1">{formatRupiah(totalGmv)}</div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
            <div className="text-[11px] font-semibold text-[#65676B] uppercase">Volume Pesanan</div>
            <div className="text-base font-black text-[#050505] mt-1">{totalOrders} order</div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
            <div className="text-[11px] font-semibold text-[#65676B] uppercase">Komposisi Paket / Satuan</div>
            <div className="text-base font-black text-[#050505] mt-1">{totalPackage} pkt / {totalLoose} sat</div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
            <div className="text-[11px] font-semibold text-[#65676B] uppercase">Fulfillment Fisik</div>
            <div className="text-base font-black text-emerald-600 mt-1">{totalFulfilled} selesai ({totalWaiting} antre)</div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E6EB] text-[#65676B] font-bold">
                <th className="pb-3">Sekolah / Cabang</th>
                <th className="pb-3 text-right">Pesanan</th>
                <th className="pb-3 text-right">GMV (Rp)</th>
                <th className="pb-3 text-right">AOV (Rp)</th>
                <th className="pb-3 text-center">Bauran</th>
                <th className="pb-3 text-center">Status Fisik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F5]">
              {data.map((row) => (
                <tr key={row.schoolId} className="hover:bg-[#F7F8FA] transition">
                  <td className="py-3">
                    <div className="font-bold text-[#050505]">{row.schoolName}</div>
                    <div className="text-[11px] text-[#8A8D91]">{row.schoolCode}</div>
                  </td>
                  <td className="py-3 text-right font-black text-[#050505]">{row.orderCount}</td>
                  <td className="py-3 text-right font-bold text-[#1877F2]">{formatRupiah(row.gmvRp)}</td>
                  <td className="py-3 text-right font-medium text-[#65676B]">{formatRupiah(row.aovRp)}</td>
                  <td className="py-3 text-center text-[11px] text-[#65676B]">
                    {row.packageCount} pkt / {row.looseCount} sat
                  </td>
                  <td className="py-3 text-center">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                      {row.fulfilledCount} selesai
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
