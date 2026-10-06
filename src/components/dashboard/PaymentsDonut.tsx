import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number | string }> }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-[#E4E6EB] shadow-md px-3 py-2 text-xs">
      <div className="font-bold text-[#050505]">{payload[0].name}</div>
      <div className="text-[#65676B]">{payload[0].value} pesanan</div>
    </div>
  );
}

/** Donat komposisi status pembayaran pesanan: lunas, cicilan, belum bayar, beasiswa. */
export function PaymentsDonut({ summary }: { summary: DashboardSchoolSummary }) {
  const p = summary.payments;
  const data = [
    { name: "Lunas", value: p.paidCount, fill: "#10B981" },
    { name: "Cicilan", value: p.partialCount, fill: "#1877F2" },
    { name: "Belum Bayar", value: p.unpaidOnlyCount, fill: "#F59E0B" },
    { name: "Beasiswa Pending", value: p.scholarshipPending, fill: "#8B5CF6" },
  ];
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 h-full">
      <div className="text-sm font-bold text-[#050505]">Komposisi Pembayaran</div>
      <div className="text-xs text-[#65676B] mb-1">{total === 0 ? "Belum ada pesanan." : `${total} pesanan berdasarkan status bayar`}</div>
      {total === 0 ? (
        <div className="py-8 text-sm text-[#65676B] text-center">Belum ada data pembayaran.</div>
      ) : (
        <>
          <div className="min-h-[180px]">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Tooltip content={<DonutTooltip />} />
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={2} strokeWidth={0}>
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-1 space-y-1">
            {data.map((d) => (
              <li key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="text-[#65676B]">{d.name}</span>
                <span className="ml-auto font-bold text-[#050505]">{d.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
