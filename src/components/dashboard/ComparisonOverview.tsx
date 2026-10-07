import { ChevronRight, Clock, PackageCheck, UserCheck } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";
import { formatRupiah } from "../../lib/transfer-pricing";

function MiniTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number | string }> }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-[#E4E6EB] shadow-md px-3 py-2 text-xs">
      <div className="font-bold text-[#050505]">{payload[0].name}</div>
      <div className="text-[#65676B]">{payload[0].value}</div>
    </div>
  );
}

function AggregateDonut({ title, subtitle, unit, data }: {
  title: string;
  subtitle: string;
  unit: string;
  data: Array<{ name: string; value: number; fill: string }>;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 h-full flex flex-col justify-between">
      <div>
        <div className="text-sm font-bold text-[#050505]">{title}</div>
        <div className="text-xs text-[#65676B] mb-1">{subtitle}</div>
      </div>
      {total === 0 ? (
        <div className="py-8 text-sm text-[#65676B] text-center">Belum ada data.</div>
      ) : (
        <>
          <div className="my-2">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Tooltip content={<MiniTooltip />} />
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={2} strokeWidth={0}>
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="divide-y divide-[#E4E6EB]">
            {data.map((d) => (
              <li key={d.name} className="py-1.5 flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="text-[#65676B] truncate">{d.name}</span>
                <span className="ml-auto font-bold text-[#050505] shrink-0">{d.value.toLocaleString("id-ID")} {unit}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function ComparisonOverview({ summaries }: { summaries: DashboardSchoolSummary[] }) {
  const funnel = summaries.reduce(
    (acc, s) => ({
      waiting: acc.waiting + s.funnel.waiting,
      ready: acc.ready + s.funnel.ready,
      picked: acc.picked + s.funnel.picked,
    }),
    { waiting: 0, ready: 0, picked: 0 }
  );
  const funnelTotal = funnel.waiting + funnel.ready + funnel.picked;

  const cond = summaries.reduce(
    (acc, s) => ({
      Baru: acc.Baru + s.stock.byCondition.new,
      Baik: acc.Baik + s.stock.byCondition.good,
      Cukup: acc.Cukup + s.stock.byCondition.fair,
      Rusak: acc.Rusak + s.stock.byCondition.damaged,
    }),
    { Baru: 0, Baik: 0, Cukup: 0, Rusak: 0 }
  );
  const condData = [
    { name: "Baru", value: cond.Baru, fill: "#10B981" },
    { name: "Baik", value: cond.Baik, fill: "#1877F2" },
    { name: "Cukup", value: cond.Cukup, fill: "#F59E0B" },
    { name: "Rusak", value: cond.Rusak, fill: "#EF4444" },
  ];

  const pay = summaries.reduce(
    (acc, s) => ({
      Lunas: acc.Lunas + s.payments.paidCount,
      Cicilan: acc.Cicilan + s.payments.partialCount,
      "Belum Bayar": acc["Belum Bayar"] + s.payments.unpaidOnlyCount,
      outstandingRp: acc.outstandingRp + s.payments.outstandingRp,
    }),
    { Lunas: 0, Cicilan: 0, "Belum Bayar": 0, outstandingRp: 0 }
  );
  const totalOrders = pay.Lunas + pay.Cicilan + pay["Belum Bayar"];
  const paidPct = totalOrders > 0 ? Math.round((pay.Lunas / totalOrders) * 100) : 0;

  const PIPELINE_STAGES = [
    { title: "1. Menunggu", count: funnel.waiting, desc: "Perlu disiapkan", icon: Clock, bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", bar: "bg-amber-500" },
    { title: "2. Siap Diambil", count: funnel.ready, desc: "Tersedia di loket", icon: PackageCheck, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", bar: "bg-[#1877F2]" },
    { title: "3. Sudah Diambil", count: funnel.picked, desc: "Diserahkan ke siswa", icon: UserCheck, bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", bar: "bg-emerald-500" },
  ];

  return (
    <div className="grid gap-4">
      {/* Aggregate Stepped Pipeline Cards */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <div className="text-sm font-bold text-[#050505]">Alur Pemenuhan Nasional (Semua Cabang)</div>
            <div className="text-xs text-[#65676B]">
              Total {funnelTotal.toLocaleString("id-ID")} pesanan mengalir di {summaries.length} sekolah
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0F2F5] text-[#65676B]">
            {summaries.length} Cabang Aktif
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PIPELINE_STAGES.map((st, idx) => {
            const pct = funnelTotal > 0 ? Math.round((st.count / funnelTotal) * 100) : 0;
            const Icon = st.icon;
            return (
              <div key={st.title} className="relative">
                <div className={`rounded-xl border ${st.border} ${st.bg} p-3.5 flex flex-col justify-between h-full`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-4 h-4 ${st.text}`} />
                      <span className={`text-xs font-bold ${st.text}`}>{st.title}</span>
                    </div>
                    <span className="text-xs font-semibold text-[#65676B]">{pct}%</span>
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-black text-[#050505]">{st.count.toLocaleString("id-ID")}</div>
                    <div className="text-[11px] text-[#65676B]">{st.desc}</div>
                  </div>
                  <div className="w-full bg-white/80 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className="hidden md:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full bg-white border border-[#E4E6EB] items-center justify-center shadow-xs">
                    <ChevronRight className="w-3 h-3 text-[#65676B]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Aggregate Condition & Payment Meter */}
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-6">
          <AggregateDonut title="Kondisi Fisik Gabungan" subtitle="Stok satuan di semua sekolah" unit="eks" data={condData} />
        </div>
        <div className="md:col-span-6">
          <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-[#050505]">Realisasi Pembayaran Gabungan</div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {paidPct}% Lunas
                </span>
              </div>
              <div className="text-xs text-[#65676B] mt-1 mb-3">Status pelunasan buku siswa seluruh cabang</div>
            </div>

            <div className="rounded-xl bg-[#F0F2F5]/80 p-3 flex items-center justify-between my-2">
              <span className="text-xs text-[#65676B]">Total Piutang Berjalan</span>
              <span className="text-sm font-black text-[#050505]">{formatRupiah(pay.outstandingRp)}</span>
            </div>

            <div>
              <div className="h-3 w-full bg-[#E4E6EB] rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${totalOrders > 0 ? (pay.Lunas / totalOrders) * 100 : 0}%` }} />
                <div className="bg-amber-500 h-full" style={{ width: `${totalOrders > 0 ? (pay.Cicilan / totalOrders) * 100 : 0}%` }} />
                <div className="bg-red-500 h-full" style={{ width: `${totalOrders > 0 ? (pay["Belum Bayar"] / totalOrders) * 100 : 0}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-[#E4E6EB] text-center text-xs">
                <div>
                  <div className="text-[#65676B]">Lunas</div>
                  <div className="font-bold text-[#050505]">{pay.Lunas.toLocaleString("id-ID")}</div>
                </div>
                <div>
                  <div className="text-[#65676B]">Cicilan</div>
                  <div className="font-bold text-[#050505]">{pay.Cicilan.toLocaleString("id-ID")}</div>
                </div>
                <div>
                  <div className="text-[#65676B]">Belum</div>
                  <div className="font-bold text-[#050505]">{pay["Belum Bayar"].toLocaleString("id-ID")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
