import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardTierBreakdown } from "../../lib/dashboard-types";
import { ChartCard, ChartEmpty, ChartTooltip } from "./chart-kit";

function TierTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number | string; dataKey?: string | number }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <ChartTooltip
      active
      title={label}
      rows={payload.map((entry) => ({
        label: entry.dataKey === "waiting" ? "Menunggu" : "Siap",
        value: entry.value,
      }))}
    />
  );
}

/** Bar horizontal per jenjang: antrean menunggu vs stok siap. */
export function TierStockBar({ breakdown }: { breakdown: DashboardTierBreakdown[] }) {
  const rows = [...breakdown]
    .sort((a, b) => b.waitingOrders - a.waitingOrders || b.readyStock - a.readyStock)
    .slice(0, 8)
    .map((r) => ({
      name: `K${r.gradeLevel} ${r.curriculumType === "international" ? "INT" : "NAS"}`,
      waiting: r.waitingOrders,
      ready: r.readyStock,
    }));
  const height = Math.max(200, rows.length * 52);
  return (
    <ChartCard
      title="Antrean vs Kesiapan per Jenjang"
      subtitle="Pesanan menunggu (kuning) lawan stok siap (biru)"
      className="h-full"
    >
      {rows.length === 0 ? (
        <ChartEmpty message="Belum ada data siswa pada sekolah ini." hint="Daarkan siswa lewat tab Siswa atau portal publik." />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#65676B" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 11, fill: "#050505", fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip content={<TierTooltip />} cursor={{ fill: "#F0F2F5" }} />
            <Bar dataKey="waiting" radius={[0, 6, 6, 0]} maxBarSize={16}>
              {rows.map((r) => (
                <Cell key={r.name} fill={r.waiting > r.ready ? "#F59E0B" : "#FCD34D"} />
              ))}
            </Bar>
            <Bar dataKey="ready" radius={[0, 6, 6, 0]} maxBarSize={16} fill="#1877F2" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
