import { exportCsvFile } from "../../lib/csv-export";
import type { ExecutiveBranchStudentBreakdown } from "../../lib/dashboard-types";
import { ExecutiveBreakdownDrawerShell } from "./ExecutiveBreakdownDrawerShell";

interface StudentBreakdownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExecutiveBranchStudentBreakdown[];
  academicYear: string;
}

export function StudentBreakdownDrawer({
  isOpen,
  onClose,
  data,
  academicYear,
}: StudentBreakdownDrawerProps) {
  const totalStudents = data.reduce((s, r) => s + r.totalStudents, 0);
  const totalOrdered = data.reduce((s, r) => s + r.orderedStudents, 0);
  const totalFulfilled = data.reduce((s, r) => s + r.fulfilledStudents, 0);
  const overallAdoptionRate = totalStudents > 0 ? Math.round((totalOrdered / totalStudents) * 1000) / 10 : 0;
  const overallFulfillmentRate = totalOrdered > 0 ? Math.round((totalFulfilled / totalOrdered) * 1000) / 10 : 0;

  const handleExportCsv = () => {
    const headers = [
      "Kode Cabang",
      "Nama Sekolah",
      "Total Siswa",
      "Siswa Memesan",
      "Tingkat Adopsi (%)",
      "Siswa Terima Barang",
      "Rasio Selesai (%)",
    ];
    const rows = data.map((r) => [
      r.schoolCode,
      `"${r.schoolName.replace(/"/g, '""')}"`,
      String(r.totalStudents),
      String(r.orderedStudents),
      String(r.adoptionRate),
      String(r.fulfilledStudents),
      String(r.orderedStudents > 0 ? Math.round((r.fulfilledStudents / r.orderedStudents) * 1000) / 10 : 0),
    ]);
    const totalRow = [
      "TOTAL",
      "Semua Cabang",
      String(totalStudents),
      String(totalOrdered),
      String(overallAdoptionRate),
      String(totalFulfilled),
      String(overallFulfillmentRate),
    ];
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(",")), totalRow.join(",")].join("\n");
    exportCsvFile(`breakdown_siswa_${academicYear.replace(/[/\\:]/g, "-")}`, csvContent);
  };

  const metricsSummary = (
    <>
      <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
        <div className="text-[11px] font-semibold text-[#65676B] uppercase">Total Populasi Siswa</div>
        <div className="text-base font-black text-[#050505] mt-1">{totalStudents} murid</div>
      </div>
      <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
        <div className="text-[11px] font-semibold text-[#65676B] uppercase">Siswa Memesan</div>
        <div className="text-base font-black text-[#1877F2] mt-1">{totalOrdered} ({overallAdoptionRate}%)</div>
      </div>
      <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
        <div className="text-[11px] font-semibold text-[#65676B] uppercase">Belum Memesan</div>
        <div className="text-base font-black text-rose-600 mt-1">{totalStudents - totalOrdered} murid</div>
      </div>
      <div className="bg-white p-3 rounded-xl border border-[#E4E6EB]">
        <div className="text-[11px] font-semibold text-[#65676B] uppercase">Terima Barang Lengkap</div>
        <div className="text-base font-black text-emerald-600 mt-1">{totalFulfilled} murid</div>
      </div>
    </>
  );

  return (
    <ExecutiveBreakdownDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      category="Breakdown Populasi & Adopsi"
      title="Partisipasi Pemesanan & Pemenuhan Siswa"
      academicYear={academicYear}
      onExportCsv={handleExportCsv}
      metricsSummary={metricsSummary}
    >
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[#E4E6EB] text-[#65676B] font-bold">
            <th className="pb-3">Sekolah / Cabang</th>
            <th className="pb-3 text-right">Populasi</th>
            <th className="pb-3 text-right">Memesan</th>
            <th className="pb-3 text-center">Adopsi (%)</th>
            <th className="pb-3 text-right">Terima Fisik</th>
            <th className="pb-3">Jenjang Breakdown</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0F2F5]">
          {data.map((row) => (
            <tr key={row.schoolId} className="hover:bg-[#F7F8FA] transition">
              <td className="py-3">
                <div className="font-bold text-[#050505]">{row.schoolName}</div>
                <div className="text-[11px] text-[#8A8D91]">{row.schoolCode}</div>
              </td>
              <td className="py-3 text-right font-black text-[#050505]">{row.totalStudents}</td>
              <td className="py-3 text-right font-bold text-[#1877F2]">{row.orderedStudents}</td>
              <td className="py-3 text-center font-bold">
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                  row.adoptionRate >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {row.adoptionRate}%
                </span>
              </td>
              <td className="py-3 text-right font-semibold text-emerald-600">{row.fulfilledStudents}</td>
              <td className="py-3">
                <div className="flex flex-wrap gap-1 max-w-xs">
                  {row.byGrade.slice(0, 4).map((g) => (
                    <span key={g.grade} className="text-[10px] bg-[#F0F2F5] px-1.5 py-0.5 rounded text-[#65676B]">
                      Kls {g.grade}: {g.ordered}/{g.total}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ExecutiveBreakdownDrawerShell>
  );
}
