import { exportCsvFile } from "../../lib/csv-export";
import type { ExecutiveBranchPoBreakdown } from "../../lib/dashboard-types";
import { formatRupiah } from "../../lib/transfer-pricing";
import { ExecutiveBreakdownDrawerShell } from "./ExecutiveBreakdownDrawerShell";

interface PoBreakdownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExecutiveBranchPoBreakdown[];
  academicYear: string;
}

export function PoBreakdownDrawer({
  isOpen,
  onClose,
  data,
  academicYear,
}: PoBreakdownDrawerProps) {
  const totalPoCount = data.reduce((s, r) => s + r.poCount, 0);
  const totalCommitment = data.reduce((s, r) => s + r.commitmentRp, 0);

  const handleExportCsv = () => {
    const headers = [
      "Kode Cabang",
      "Nama Sekolah / Cabang Pemesan",
      "Jumlah PO",
      "Total Komitmen Belanja (Rp)",
      "Status Realisasi",
    ];
    const rows = data.map((r) => [
      r.schoolCode,
      `"${r.schoolName.replace(/"/g, '""')}"`,
      String(r.poCount),
      String(r.commitmentRp),
      "100%",
    ]);
    const totalRow = [
      "TOTAL",
      "Semua Cabang",
      String(totalPoCount),
      String(totalCommitment),
      "100%",
    ];
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(",")), totalRow.join(",")].join("\n");
    exportCsvFile(`breakdown_po_${academicYear.replace(/[/\\:]/g, "-")}`, csvContent);
  };

  const metricsSummary = (
    <>
      <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
        <div className="text-[11px] font-semibold text-[#65676B] uppercase">Total Komitmen Belanja</div>
        <div className="text-base font-black text-[#1877F2] mt-1">{formatRupiah(totalCommitment)}</div>
      </div>
      <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
        <div className="text-[11px] font-semibold text-[#65676B] uppercase">Total Dokumen PO</div>
        <div className="text-base font-black text-[#050505] mt-1">{totalPoCount} dokumen</div>
      </div>
      <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
        <div className="text-[11px] font-semibold text-[#65676B] uppercase">Realisasi Kedatangan</div>
        <div className="text-base font-black text-emerald-600 mt-1">100% On-Track</div>
      </div>
    </>
  );

  return (
    <ExecutiveBreakdownDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      category="Breakdown Pengadaan (PO)"
      title="Komitmen Belanja & Pipeline per Lokasi"
      academicYear={academicYear}
      maxWidthClass="max-w-3xl"
      onExportCsv={handleExportCsv}
      metricsSummary={metricsSummary}
    >
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[#E4E6EB] text-[#65676B] font-bold">
            <th className="pb-3">Lokasi / Cabang Pemesan</th>
            <th className="pb-3 text-right">Jumlah PO</th>
            <th className="pb-3 text-right">Komitmen Belanja (Rp)</th>
            <th className="pb-3 text-center">Realisasi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0F2F5]">
          {data.map((row) => (
            <tr key={row.schoolId} className="hover:bg-[#F7F8FA] transition">
              <td className="py-3">
                <div className="font-bold text-[#050505]">{row.schoolName}</div>
                <div className="text-[11px] text-[#8A8D91]">{row.schoolCode}</div>
              </td>
              <td className="py-3 text-right font-black text-[#050505]">{row.poCount}</td>
              <td className="py-3 text-right font-bold text-[#1877F2]">{formatRupiah(row.commitmentRp)}</td>
              <td className="py-3 text-center">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                  Terkirim / Selesai
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ExecutiveBreakdownDrawerShell>
  );
}
