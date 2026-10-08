import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";
import { ChartCard, ChartEmpty, ChartTooltip as KitTooltip } from "./chart-kit";
import { coverageTone } from "./coverage-tone";
import { formatCount } from "../../lib/transfer-pricing";

function CoverageTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { fullName: string; value: number; ready: number; waiting: number } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <KitTooltip
      active
      title={data.fullName}
      rows={[
        { label: "Cakupan Paket", value: `${data.value}%` },
        { label: "Kesiapan", value: `${formatCount(data.ready)} paket siap / ${formatCount(data.waiting)} pesanan` },
      ]}
    />
  );
}

export function CoverageChart({
  summaries,
  onSelectSchool,
}: {
  summaries: DashboardSchoolSummary[];
  onSelectSchool?: (schoolId: string) => void;
}) {
  // Sort from lowest to highest so critical branches appear clearly
  const sorted = [...summaries].sort(
    (a, b) => (a.coverage.ratio ?? 2) - (b.coverage.ratio ?? 2)
  );

  const data = sorted.map((s) => ({
    id: s.school.id,
    name: s.school.name.length > 18 ? `${s.school.name.slice(0, 16)}…` : s.school.name,
    fullName: s.school.name,
    code: s.school.code,
    value: s.coverage.ratio === null ? 100 : Math.min(100, Math.round(s.coverage.ratio * 100)),
    ready: s.coverage.readyPackages,
    waiting: s.coverage.waitingOrders,
    fill: coverageTone(s.coverage.ratio).bar,
  }));

  if (data.length === 0) {
    return (
      <ChartCard title="Peringkat Kesiapan per Sekolah">
        <ChartEmpty message="Belum ada data sekolah untuk dibandingkan." />
      </ChartCard>
    );
  }

  const height = Math.max(220, data.length * 38);

  return (
    <ChartCard
      title="Peringkat Kesiapan per Sekolah"
      subtitle="Persentase kesiapan paket buku terhadap antrean pesanan di masing-masing cabang"
      className="h-full flex flex-col justify-between"
      action={
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0F2F5] text-[#65676B]">
          Urutan Kritis ke Aman
        </span>
      }
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 28, bottom: 4, left: 12 }}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#65676B" }}
              axisLine={false}
              tickLine={false}
              unit="%"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 11, fill: "#050505", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CoverageTooltip />} cursor={{ fill: "#F0F2F5" }} />
            <Bar
              dataKey="value"
              radius={[0, 6, 6, 0]}
              maxBarSize={18}
              onClick={(entry) => {
                const item = entry as unknown as { id?: string };
                if (item?.id && onSelectSchool) {
                  onSelectSchool(item.id);
                }
              }}
              cursor={onSelectSchool ? "pointer" : "default"}
            >
              {data.map((d) => (
                <Cell key={d.id} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
