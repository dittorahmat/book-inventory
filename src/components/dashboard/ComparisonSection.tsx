import { LayoutDashboard } from "lucide-react";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";
import { formatRupiah } from "../../lib/transfer-pricing";
import { coverageTone } from "../../lib/dashboard-tone";
import { ComparisonOverview } from "./ComparisonOverview";
import { BranchHealthScatter } from "./BranchHealthScatter";
import { CoverageChart } from "./CoverageChart";

function attentionTotal(s: DashboardSchoolSummary): number {
  const a = s.attention;
  return a.damaged + a.lost + a.returnsReported + a.transfersInTransit + a.poUnreceived;
}

interface ComparisonSectionProps {
  summaries: DashboardSchoolSummary[];
  onSelectSchool: (id: string) => void;
}

/** Komposit perbandingan antar sekolah: hero perhatian + grafik + peringkat. */
export function ComparisonSection({ summaries, onSelectSchool }: ComparisonSectionProps) {
  const ranked = [...summaries].sort((a, b) => (a.coverage.ratio ?? 2) - (b.coverage.ratio ?? 2));
  const weakest = ranked[0];
  const weakestTone = weakest ? coverageTone(weakest.coverage.ratio) : null;
  return (
    <div className="grid gap-4">
      {weakest && weakestTone ? (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#E7F3FF] flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-5 h-5 text-[#1877F2]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#65676B]">Perhatian utama</div>
            <div className="text-sm font-bold text-[#050505] truncate">
              {weakest.school.name} - cakupan {weakest.coverage.ratio === null ? 100 : Math.min(100, Math.round(weakest.coverage.ratio * 100))}%
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectSchool(weakest.school.id)}
            className="ml-auto shrink-0 px-4 py-2 text-sm font-semibold text-white bg-[#1877F2] rounded-xl hover:bg-[#1664D9] active:scale-[0.98] transition"
          >
            Detail
          </button>
        </div>
      ) : null}
      <ComparisonOverview summaries={summaries} />
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-12 lg:col-span-7">
          <BranchHealthScatter summaries={summaries} onSelectSchool={onSelectSchool} />
        </div>
        <div className="md:col-span-12 lg:col-span-5">
          <CoverageChart summaries={summaries} onSelectSchool={onSelectSchool} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {ranked.map((s) => {
          const tone = coverageTone(s.coverage.ratio);
          return (
            <button
              key={s.school.id}
              type="button"
              onClick={() => onSelectSchool(s.school.id)}
              style={{ borderLeftColor: tone.bar }}
              className="bg-white rounded-2xl border border-[#E4E6EB] border-l-4 p-5 text-left hover:border-[#1877F2]/40 active:scale-[0.98] transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-[#050505] truncate">{s.school.name}</div>
                <span className={`shrink-0 text-xs font-bold ${tone.text}`}>
                  {s.coverage.ratio === null ? 100 : Math.min(100, Math.round(s.coverage.ratio * 100))}%
                </span>
              </div>
              <div className="mt-1 text-xs text-[#65676B]">
                {s.stock.looseInStock} satuan - {s.coverage.readyPackages} paket siap
              </div>
              <div className="mt-1 text-xs text-[#65676B]">
                Tunggakan {formatRupiah(s.payments.outstandingRp)} - {attentionTotal(s)} perhatian
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
