import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { DashboardCoverage } from "../../lib/dashboard-types";
import { ChartCard } from "./chart-kit";
import { coverageTone } from "../../lib/dashboard-tone";

export function CoverageGauge({ coverage }: { coverage: DashboardCoverage }) {
  const tone = coverageTone(coverage.ratio);
  const percentage = coverage.ratio === null ? 100 : Math.min(100, Math.round(coverage.ratio * 100));

  // Visual arc data: value slice + remaining background track slice
  const data = [
    { name: "Selesai", value: percentage, fill: tone.bar },
    { name: "Sisa", value: Math.max(0, 100 - percentage), fill: "#F0F2F5" },
  ];

  return (
    <ChartCard
      title="Kesiapan Paket (Coverage)"
      subtitle={`Perbandingan paket siap (${coverage.readyPackages}) vs antrean pesanan (${coverage.waitingOrders})`}
      className="h-full flex flex-col justify-between"
    >
      <div className="relative my-2 flex items-center justify-center">
        <div className="w-full max-w-[240px] h-[125px]">
          <ResponsiveContainer width="100%" height={125}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                startAngle={180}
                endAngle={0}
                cx="50%"
                cy="95%"
                innerRadius={68}
                outerRadius={92}
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`gauge-cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Center Text inside the Arc */}
        <div className="absolute bottom-2 text-center pointer-events-none">
          <div className={`text-3xl font-black ${tone.text}`}>
            {coverage.ratio === null ? "100%" : `${percentage}%`}
          </div>
          <div className="text-[11px] font-bold text-[#65676B] uppercase tracking-wider">
            {coverage.ratio === null || percentage >= 90
              ? "Aman"
              : percentage >= 70
              ? "Waspada"
              : "Defisit"}
          </div>
        </div>
      </div>

      {/* Threshold / Shortfall explanation */}
      <div className="mt-1 pt-3 border-t border-[#E4E6EB] flex items-center justify-between text-xs">
        <span className="text-[#65676B]">Kekurangan:</span>
        {coverage.shortfall > 0 ? (
          <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            Kurang {coverage.shortfall} paket
          </span>
        ) : (
          <span className="font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            Semua paket terpenuhi
          </span>
        )}
      </div>
    </ChartCard>
  );
}
