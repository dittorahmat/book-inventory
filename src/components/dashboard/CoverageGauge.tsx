import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";
import { coverageTone } from "./dashboard-format";

export function CoverageGauge({ summary }: { summary: DashboardSchoolSummary }) {
  const ratio = summary.coverage.ratio;
  const tone = coverageTone(ratio);
  const percentage = ratio === null ? 100 : Math.min(100, Math.round(ratio * 100));

  // Visual arc data: value slice + remaining background track slice
  const data = [
    { name: "Selesai", value: percentage, fill: tone.bar },
    { name: "Sisa", value: Math.max(0, 100 - percentage), fill: "#F0F2F5" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 flex flex-col justify-between">
      <div>
        <div className="text-sm font-bold text-[#050505]">Kesiapan Paket (Coverage)</div>
        <div className="text-xs text-[#65676B]">
          Perbandingan paket siap ({summary.coverage.readyPackages}) vs antrean pesanan ({summary.coverage.waitingOrders})
        </div>
      </div>

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
            {ratio === null ? "100%" : `${percentage}%`}
          </div>
          <div className="text-[11px] font-bold text-[#65676B] uppercase tracking-wider">
            {ratio === null || percentage >= 90
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
        {summary.coverage.shortfall > 0 ? (
          <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            Kurang {summary.coverage.shortfall} paket
          </span>
        ) : (
          <span className="font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            Semua paket terpenuhi
          </span>
        )}
      </div>
    </div>
  );
}
