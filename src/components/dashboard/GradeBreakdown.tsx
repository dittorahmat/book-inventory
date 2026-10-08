import type { DashboardTierBreakdown } from "../../lib/dashboard-types";
import { ChartCard, ChartEmpty } from "./chart-kit";
import { formatCount } from "../../lib/transfer-pricing";

export function GradeBreakdown({ breakdown }: { breakdown: DashboardTierBreakdown[] }) {
  const rows = [...breakdown].sort((a, b) => b.shortfall - a.shortfall || b.waitingOrders - a.waitingOrders);
  return (
    <ChartCard title="Per Jenjang" subtitle="Siswa, antrean, dan kesiapan per kelas dan kurikulum">
      {rows.length === 0 ? (
        <ChartEmpty message="Belum ada data siswa pada sekolah ini." hint="Daarkan siswa lewat tab Siswa atau portal publik." />
      ) : (
        <ul className="divide-y divide-[#E4E6EB] border-t border-[#E4E6EB]">
          {rows.map((r) => (
            <li key={`${r.gradeLevel}|${r.curriculumType}`} className="py-3 flex items-center gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#050505] truncate">
                  Kelas {r.gradeLevel} - {r.curriculumType === "international" ? "Internasional" : "Nasional"}
                </div>
                <div className="text-xs text-[#65676B]">{formatCount(r.students)} siswa - {formatCount(r.waitingOrders)} menunggu, {formatCount(r.readyStock)} siap</div>
              </div>
              {r.shortfall > 0 ? (
                <span className="ml-auto shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                  Kurang {formatCount(r.shortfall)}
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
    </ChartCard>
  );
}
