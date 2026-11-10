import { exportCsvFile } from "../../lib/csv-export";
import type { ExecutiveBranchCashBreakdown } from "../../lib/dashboard-types";
import { formatRupiah } from "../../lib/transfer-pricing";
import { ExecutiveBreakdownDrawerShell } from "./ExecutiveBreakdownDrawerShell";

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
    exportCsvFile(`breakdown_kas_${academicYear.replace(/[/\\:]/g, "-")}`, csvContent);
  };

  const metricsSummary = (
    <>
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
    </>
  );

  return (
    <ExecutiveBreakdownDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      category="Breakdown Keuangan"
      title="Arus Kas Masuk & Piutang per Cabang"
      academicYear={academicYear}
      maxWidthClass="max-w-3xl"
      onExportCsv={handleExportCsv}
      metricsSummary={metricsSummary}
    >
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
    </ExecutiveBreakdownDrawerShell>
  );
}
