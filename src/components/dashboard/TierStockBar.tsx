import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";

function TierTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number | string; dataKey?: string | number }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-[#E4E6EB] shadow-md px-3 py-2 text-xs">
      <div className="font-bold text-[#050505]">{label}</div>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="text-[#65676B]">
          {entry.dataKey === "waiting" ? "Menunggu" : "Siap"}: {entry.value}
        </div>
      ))}
    </div>
  );
}

/** Bar horizontal per jenjang: antrean menunggu vs stok siap. */
export function TierStockBar({ summary }: { summary: DashboardSchoolSummary }) {
  const rows = [...summary.breakdown]
    .sort((a, b) => b.waitingOrders - a.waitingOrders || b.readyStock - a.readyStock)
    .slice(0, 8)
    .map((r) => ({
      name: `K${r.gradeLevel} ${r.curriculumType === "international" ? "INT" : "NAS"}`,
      waiting: r.waitingOrders,
      ready: r.readyStock,
    }));
  const height = Math.max(200, rows.length * 52);
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 h-full">
      <div className="text-sm font-bold text-[#050505]">Antrean vs Kesiapan per Jenjang</div>
      <div className="text-xs text-[#65676B] mb-3">Pesanan menunggu (kuning) lawan stok siap (biru)</div>
      {rows.length === 0 ? (
        <div className="py-8 text-sm text-[#65676B] text-center">Belum ada data siswa pada sekolah ini.</div>
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
    </div>
  );
}
