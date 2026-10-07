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
import { coverageTone } from "./dashboard-format";

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
    <div className="bg-white rounded-xl border border-[#E4E6EB] shadow-lg p-3 text-xs">
      <div className="font-bold text-[#050505]">{p.name} ({p.code})</div>
      <div className="mt-1.5 space-y-1 text-[#65676B]">
        <div className="flex items-center justify-between gap-4">
          <span>Kesiapan Stok:</span>
          <span className="font-bold text-[#050505]">{p.coverage}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Pelunasan Tagihan:</span>
          <span className="font-bold text-[#050505]">{p.payment}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Total Pesanan:</span>
          <span className="font-semibold text-[#1877F2]">{p.orders} siswa</span>
        </div>
      </div>
    </div>
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
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-[#050505]">Matriks Kesehatan Cabang</div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0F2F5] text-[#65676B]">
            Stok vs Keuangan
          </span>
        </div>
        <div className="text-xs text-[#65676B] mt-1 mb-2">
          Pemetaan 4 kuadran: Kesiapan Paket (Sumbu X) vs Pelunasan Pembayaran (Sumbu Y). Klik titik untuk drill-down.
        </div>
      </div>

      {points.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#65676B]">
          Belum ada data sekolah untuk dibandingkan.
        </div>
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
    </div>
  );
}
