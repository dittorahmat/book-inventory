import { useState } from "react";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import type { School } from "../types";
import type { DashboardSchoolSummary } from "../lib/dashboard-types";
import { useDashboard } from "../components/dashboard/useDashboard";
import { DashboardKpis } from "../components/dashboard/DashboardKpis";
import { coverageTone, formatRp } from "../components/dashboard/dashboard-format";
import { CoverageChart } from "../components/dashboard/CoverageChart";
import { BranchHealthScatter } from "../components/dashboard/BranchHealthScatter";
import { ComparisonOverview } from "../components/dashboard/ComparisonOverview";
import { FunnelChart } from "../components/dashboard/FunnelChart";
import { ConditionDonut } from "../components/dashboard/ConditionDonut";
import { CoverageGauge } from "../components/dashboard/CoverageGauge";
import { StockTreemap } from "../components/dashboard/StockTreemap";
import { PaymentsMeter } from "../components/dashboard/PaymentsMeter";
import { TierStockBar } from "../components/dashboard/TierStockBar";
import { GradeBreakdown } from "../components/dashboard/GradeBreakdown";
import { AttentionList } from "../components/dashboard/AttentionList";

interface DashboardViewProps {
  activeSchool: School | null;
  isCentralAdmin: boolean;
  onNavigateTab: (tab: string) => void;
}

function attentionTotal(s: DashboardSchoolSummary): number {
  const a = s.attention;
  return a.damaged + a.lost + a.returnsReported + a.transfersInTransit + a.poUnreceived;
}

function DetailSection({ summary, onNavigateTab }: { summary: DashboardSchoolSummary; onNavigateTab: (tab: string) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-12">
      <div className="md:col-span-12">
        <DashboardKpis summary={summary} />
      </div>
      <div className="md:col-span-12 lg:col-span-8">
        <FunnelChart summary={summary} />
      </div>
      <div className="md:col-span-12 lg:col-span-4">
        <CoverageGauge summary={summary} />
      </div>
      <div className="md:col-span-12 lg:col-span-8">
        <StockTreemap summary={summary} />
      </div>
      <div className="md:col-span-12 lg:col-span-4">
        <ConditionDonut summary={summary} />
      </div>
      <div className="md:col-span-12 lg:col-span-8">
        <TierStockBar summary={summary} />
      </div>
      <div className="md:col-span-12 lg:col-span-4">
        <PaymentsMeter summary={summary} />
      </div>
      <div className="md:col-span-12 lg:col-span-5">
        <GradeBreakdown summary={summary} />
      </div>
      <div className="md:col-span-12 lg:col-span-7">
        <AttentionList summary={summary} onNavigate={onNavigateTab} />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-label="Memuat dashboard">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`bg-white rounded-2xl border border-[#E4E6EB] p-5 ${i === 0 ? "md:col-span-2" : ""}`}>
          <div className="h-4 w-32 rounded bg-[#F0F2F5] animate-pulse" />
          <div className="mt-3 h-8 w-24 rounded bg-[#F0F2F5] animate-pulse" />
          <div className="mt-3 h-2 rounded-full bg-[#F0F2F5] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function DashboardView({ activeSchool, isCentralAdmin, onNavigateTab }: DashboardViewProps) {
  const [drillId, setDrillId] = useState<string | null>(null);
  const schoolId = isCentralAdmin ? drillId : activeSchool?.id ?? null;
  const { data, isLoading, error, retry } = useDashboard(schoolId);

  if (!isCentralAdmin && !activeSchool) {
    return (
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-8 text-center text-sm text-[#65676B]">
        Belum ada sekolah yang ditetapkan untuk akun ini. Hubungi admin pusat.
      </div>
    );
  }

  if (isLoading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-8 text-center">
        <div className="text-sm font-semibold text-[#050505]">Dashboard gagal dimuat</div>
        <div className="mt-1 text-sm text-[#65676B]">{error ?? "Terjadi kesalahan tak terduga."}</div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={retry}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#1877F2] rounded-xl hover:bg-[#1664D9] active:scale-[0.98] transition"
          >
            Coba Lagi
          </button>
          <button
            type="button"
            onClick={() => {
              const detail = `Dashboard error ${new Date().toISOString()} :: ${error ?? "unknown"} :: schoolId=${schoolId ?? "-"}`;
              if (navigator.clipboard) navigator.clipboard.writeText(detail).catch(() => {});
            }}
            className="px-4 py-2 text-sm font-semibold text-[#050505] bg-white border border-[#CED0D4] rounded-xl hover:bg-[#F0F2F5] active:scale-[0.98] transition"
          >
            Salin Detail
          </button>
        </div>
      </div>
    );
  }

  if (data.mode === "comparison" && !drillId) {
    const ranked = [...data.schools].sort((a, b) => (a.coverage.ratio ?? 2) - (b.coverage.ratio ?? 2));
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
              onClick={() => setDrillId(weakest.school.id)}
              className="ml-auto shrink-0 px-4 py-2 text-sm font-semibold text-white bg-[#1877F2] rounded-xl hover:bg-[#1664D9] active:scale-[0.98] transition"
            >
              Detail
            </button>
          </div>
        ) : null}
        <ComparisonOverview summaries={data.schools} />
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-12 lg:col-span-7">
            <BranchHealthScatter summaries={data.schools} onSelectSchool={setDrillId} />
          </div>
          <div className="md:col-span-12 lg:col-span-5">
            <CoverageChart summaries={data.schools} onSelectSchool={setDrillId} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {ranked.map((s) => {
            const tone = coverageTone(s.coverage.ratio);
            return (
              <button
                key={s.school.id}
                type="button"
                onClick={() => setDrillId(s.school.id)}
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
                  Tunggakan {formatRp(s.payments.outstandingRp)} - {attentionTotal(s)} perhatian
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const summary = drillId ? data.schools.find((s) => s.school.id === drillId) ?? data.schools[0] : data.schools[0];
  if (!summary) {
    return (
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-8 text-center text-sm text-[#65676B]">
        Belum ada data sekolah untuk ditampilkan.
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {drillId ? (
        <div>
          <button
            type="button"
            onClick={() => setDrillId(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#050505] bg-white border border-[#CED0D4] rounded-xl hover:bg-[#F0F2F5] active:scale-[0.98] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Semua Sekolah
          </button>
        </div>
      ) : null}
      <DetailSection summary={summary} onNavigateTab={onNavigateTab} />
    </div>
  );
}
