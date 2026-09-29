import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";
import { coverageTone } from "./dashboard-format";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number | string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-[#E4E6EB] shadow-md px-3 py-2 text-xs">
      <div className="font-bold text-[#050505]">{label}</div>
      <div className="text-[#65676B]">Cakupan {payload[0].value}%</div>
    </div>
  );
}

export function CoverageChart({ summaries }: { summaries: DashboardSchoolSummary[] }) {
  const data = summaries.map((s) => ({
    name: s.school.code,
    fullName: s.school.name,
    value: s.coverage.ratio === null ? 100 : Math.min(100, Math.round(s.coverage.ratio * 100)),
    fill: coverageTone(s.coverage.ratio).bar,
  }));
  if (data.length === 0) {
    return <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 text-sm text-[#65676B]">Belum ada data sekolah untuk dibandingkan.</div>;
  }
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5">
      <div className="text-sm font-bold text-[#050505]">Cakupan per Sekolah</div>
      <div className="text-xs text-[#65676B] mb-3">Persentase paket siap terhadap pesanan menunggu</div>
      <div className="min-h-[220px]">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#65676B" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#65676B" }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F0F2F5" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
