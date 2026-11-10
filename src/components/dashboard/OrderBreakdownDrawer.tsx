import { exportCsvFile } from "../../lib/csv-export";
import type { ExecutiveBranchOrderBreakdown } from "../../lib/dashboard-types";
import { formatRupiah } from "../../lib/transfer-pricing";
import { ExecutiveBreakdownDrawerShell } from "./ExecutiveBreakdownDrawerShell";

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
    exportCsvFile(`breakdown_pesanan_${academicYear.replace(/[/\\:]/g, "-")}`, csvContent);
  };

  const metricsSummary = (
    <>
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
    </>
  );

  return (
    <ExecutiveBreakdownDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      category="Breakdown Pesanan"
      title="Volume, GMV & Bauran Produk per Cabang"
      academicYear={academicYear}
      onExportCsv={handleExportCsv}
      metricsSummary={metricsSummary}
    >
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
    </ExecutiveBreakdownDrawerShell>
  );
}
