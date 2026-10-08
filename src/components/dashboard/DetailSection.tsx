import type { DashboardSchoolSummary } from "../../lib/dashboard-types";
import { DashboardKpis } from "./DashboardKpis";
import { FunnelChart } from "./FunnelChart";
import { CoverageGauge } from "./CoverageGauge";
import { StockTreemap } from "./StockTreemap";
import { ConditionDonut } from "./ConditionDonut";
import { TierStockBar } from "./TierStockBar";
import { PaymentsMeter } from "./PaymentsMeter";
import { GradeBreakdown } from "./GradeBreakdown";
import { AttentionList } from "./AttentionList";

/** Komposit rincian satu sekolah: seluruh grafik detail di satu seam. */
export function DetailSection({ summary, onNavigateTab }: { summary: DashboardSchoolSummary; onNavigateTab: (tab: string) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-12">
      <div className="md:col-span-12">
        <DashboardKpis coverage={summary.coverage} stock={summary.stock} payments={summary.payments} />
      </div>
      <div className="md:col-span-12 lg:col-span-8">
        <FunnelChart funnel={summary.funnel} />
      </div>
      <div className="md:col-span-12 lg:col-span-4">
        <CoverageGauge coverage={summary.coverage} />
      </div>
      <div className="md:col-span-12 lg:col-span-8">
        <StockTreemap titles={summary.stock.byTitle} />
      </div>
      <div className="md:col-span-12 lg:col-span-4">
        <ConditionDonut byCondition={summary.stock.byCondition} />
      </div>
      <div className="md:col-span-12 lg:col-span-8">
        <TierStockBar breakdown={summary.breakdown} />
      </div>
      <div className="md:col-span-12 lg:col-span-4">
        <PaymentsMeter payments={summary.payments} />
      </div>
      <div className="md:col-span-12 lg:col-span-5">
        <GradeBreakdown breakdown={summary.breakdown} />
      </div>
      <div className="md:col-span-12 lg:col-span-7">
        <AttentionList attention={summary.attention} onNavigate={onNavigateTab} />
      </div>
    </div>
  );
}
