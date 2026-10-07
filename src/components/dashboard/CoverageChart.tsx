import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";
import { coverageTone } from "./dashboard-format";

function ChartTooltip({
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
    <div className="bg-white rounded-xl border border-[#E4E6EB] shadow-md px-3 py-2 text-xs">
      <div className="font-bold text-[#050505]">{data.fullName}</div>
      <div className="text-[#65676B] mt-1">Cakupan Paket: <strong className="text-[#050505]">{data.value}%</strong></div>
      <div className="text-[#65676B]">{data.ready} paket siap / {data.waiting} pesanan</div>
    </div>
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
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 text-sm text-[#65676B]">
        Belum ada data sekolah untuk dibandingkan.
      </div>
    );
  }

  const height = Math.max(220, data.length * 38);

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-[#050505]">Peringkat Kesiapan per Sekolah</div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0F2F5] text-[#65676B]">
            Urutan Kritis ke Aman
          </span>
        </div>
        <div className="text-xs text-[#65676B] mt-1 mb-3">
          Persentase kesiapan paket buku terhadap antrean pesanan di masing-masing cabang
        </div>
      </div>

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
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F0F2F5" }} />
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
    </div>
  );
}
