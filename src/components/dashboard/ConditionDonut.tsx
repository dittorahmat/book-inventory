import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartCard, ChartEmpty, ChartTooltip } from "./chart-kit";
import { formatCount } from "../../lib/transfer-pricing";

const SLICES = [
  { key: "new", label: "Baru", fill: "#10B981" },
  { key: "good", label: "Baik", fill: "#1877F2" },
  { key: "fair", label: "Cukup", fill: "#F59E0B" },
  { key: "damaged", label: "Rusak", fill: "#EF4444" },
] as const;

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number | string }> }) {
  if (!active || !payload || payload.length === 0) return null;
  return <ChartTooltip active title={String(payload[0].name)} rows={[{ label: "Jumlah", value: `${payload[0].value} eksemplar` }]} />;
}

export function ConditionDonut({ byCondition }: { byCondition: Record<string, number> }) {
  const data = SLICES.map((s) => ({ name: s.label, value: byCondition[s.key] ?? 0, fill: s.fill }));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <ChartCard title="Kondisi Fisik" subtitle="Stok satuan yang tersedia di sekolah">
      {total === 0 ? (
        <ChartEmpty message="Belum ada stok satuan tercatat." hint="Tambahkan eksemplar lewat katalog atau terima PO." />
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
          <ul className="mt-1 divide-y divide-[#E4E6EB]">
            {data.map((d) => (
              <li key={d.name} className="py-2 flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="text-[#65676B]">{d.name}</span>
                <span className="ml-auto font-bold text-[#050505]">{formatCount(d.value)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  );
}
