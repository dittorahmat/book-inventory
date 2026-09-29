import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";

const STAGES = [
  { key: "waiting", label: "Menunggu", fill: "#F59E0B" },
  { key: "ready", label: "Siap Diambil", fill: "#1877F2" },
  { key: "picked", label: "Diambil", fill: "#10B981" },
] as const;

function FunnelTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number | string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-[#E4E6EB] shadow-md px-3 py-2 text-xs">
      <div className="font-bold text-[#050505]">{label}</div>
      <div className="text-[#65676B]">{payload[0].value} pesanan</div>
    </div>
  );
}

export function FunnelChart({ summary }: { summary: DashboardSchoolSummary }) {
  const total = summary.funnel.waiting + summary.funnel.ready + summary.funnel.picked;
  const data = STAGES.map((s) => ({ name: s.label, value: summary.funnel[s.key], fill: s.fill }));
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5">
      <div className="text-sm font-bold text-[#050505]">Alur Pemenuhan</div>
      <div className="text-xs text-[#65676B] mb-3">{total === 0 ? "Belum ada pesanan pada periode ini." : `${total} pesanan mengalir dari penyiapan hingga serah terima`}</div>
      <div className="min-h-[200px]">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#65676B" }} axisLine={false} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#65676B" }} axisLine={false} tickLine={false} />
            <Tooltip content={<FunnelTooltip />} cursor={{ fill: "#F0F2F5" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
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
