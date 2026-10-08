import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";
import { ChartCard, ChartEmpty, ChartTooltip as KitTooltip } from "./chart-kit";
import { coverageTone } from "../../lib/dashboard-tone";
import { formatCount } from "../../lib/transfer-pricing";

interface PointData {
  schoolId: string;
  name: string;
  code: string;
  coverage: number;
  payment: number;
  orders: number;
  fill: string;
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: PointData }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  return (
    <KitTooltip
      active
      title={`${p.name} (${p.code})`}
      rows={[
        { label: "Kesiapan Stok", value: `${p.coverage}%` },
        { label: "Pelunasan Tagihan", value: `${p.payment}%` },
        { label: "Total Pesanan", value: `${formatCount(p.orders)} siswa` },
      ]}
    />
  );
}

export function BranchHealthScatter({
  summaries,
  onSelectSchool,
}: {
  summaries: DashboardSchoolSummary[];
  onSelectSchool?: (schoolId: string) => void;
}) {
  const points: PointData[] = summaries.map((s) => {
    const cov = s.coverage.ratio === null ? 100 : Math.min(100, Math.round(s.coverage.ratio * 100));
    const pay = Math.round(s.payments.paidShare * 100);
    const totalOrders = s.payments.totalOrders || 1;
    const tone = coverageTone(s.coverage.ratio);

    return {
      schoolId: s.school.id,
      name: s.school.name,
      code: s.school.code,
      coverage: cov,
      payment: pay,
      orders: totalOrders,
      fill: tone.bar,
    };
  });

  return (
    <ChartCard
      title="Matriks Kesehatan Cabang"
      subtitle="Pemetaan 4 kuadran: Kesiapan Paket (Sumbu X) vs Pelunasan Pembayaran (Sumbu Y). Klik titik untuk drill-down."
      className="h-full flex flex-col justify-between"
      action={
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0F2F5] text-[#65676B]">
          Stok vs Keuangan
        </span>
      }
    >
      {points.length === 0 ? (
        <ChartEmpty message="Belum ada data sekolah untuk dibandingkan." />
      ) : (
        <div className="relative">
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 12, right: 16, bottom: 12, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
                <XAxis
                  type="number"
                  dataKey="coverage"
                  name="Kesiapan Stok"
                  unit="%"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#65676B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="payment"
                  name="Pelunasan"
                  unit="%"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#65676B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <ZAxis type="number" dataKey="orders" range={[90, 450]} />
                <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                
                {/* 70% threshold guidelines to divide quadrants */}
                <ReferenceLine x={70} stroke="#CED0D4" strokeDasharray="4 4" />
                <ReferenceLine y={70} stroke="#CED0D4" strokeDasharray="4 4" />

                <Scatter
                  data={points}
                  onClick={(data) => {
                    const p = data as unknown as PointData;
                    if (p?.schoolId && onSelectSchool) {
                      onSelectSchool(p.schoolId);
                    }
                  }}
                  cursor="pointer"
                >
                  {points.map((entry, index) => (
                    <Cell
                      key={`scatter-cell-${index}`}
                      fill={entry.fill}
                      fillOpacity={0.85}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Quadrant Legend Labels */}
          <div className="mt-2 pt-2 border-t border-[#E4E6EB] grid grid-cols-2 gap-2 text-[11px] text-[#65676B]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Kanan-Atas: <strong>Ideal (Stok & Bayar Siap)</strong></span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Kiri-Bawah: <strong>Kritis (Defisit Stok & Bayar)</strong></span>
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
