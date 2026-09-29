import type { DashboardSchoolSummary } from "../../lib/dashboard-types";

export function GradeBreakdown({ summary }: { summary: DashboardSchoolSummary }) {
  const rows = [...summary.breakdown].sort((a, b) => b.shortfall - a.shortfall || b.waitingOrders - a.waitingOrders);
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="text-sm font-bold text-[#050505]">Per Jenjang</div>
        <div className="text-xs text-[#65676B]">Siswa, antrean, dan kesiapan per kelas dan kurikulum</div>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 pb-5 text-sm text-[#65676B]">Belum ada data siswa pada sekolah ini.</div>
      ) : (
        <ul className="divide-y divide-[#E4E6EB] border-t border-[#E4E6EB]">
          {rows.map((r) => (
            <li key={`${r.gradeLevel}|${r.curriculumType}`} className="px-5 py-3 flex items-center gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#050505] truncate">
                  Kelas {r.gradeLevel} - {r.curriculumType === "international" ? "Internasional" : "Nasional"}
                </div>
                <div className="text-xs text-[#65676B]">{r.students} siswa - {r.waitingOrders} menunggu, {r.readyStock} siap</div>
              </div>
              {r.shortfall > 0 ? (
                <span className="ml-auto shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                  Kurang {r.shortfall}
                </span>
              ) : (
                <span className="ml-auto shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Aman
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
