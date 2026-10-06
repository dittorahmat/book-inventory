import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DashboardSchoolSummary } from "../../lib/dashboard-types";

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
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 h-full">
      <div className="text-sm font-bold text-[#050505]">{title}</div>
      <div className="text-xs text-[#65676B] mb-1">{subtitle}</div>
      {total === 0 ? (
        <div className="py-8 text-sm text-[#65676B] text-center">Belum ada data.</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Tooltip content={<MiniTooltip />} />
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={2} strokeWidth={0}>
                {data.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-1 space-y-1">
            {data.map((d) => (
              <li key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="text-[#65676B] truncate">{d.name}</span>
                <span className="ml-auto font-bold text-[#050505] shrink-0">{d.value} {unit}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Ringkasan agregat lintas sekolah: satu bar bertumpuk alur pemenuhan
 * plus dua donat (kondisi fisik & komposisi pembayaran).
 */
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
  const funnelSegs = [
    { name: "Menunggu", value: funnel.waiting, fill: "#F59E0B" },
    { name: "Siap Diambil", value: funnel.ready, fill: "#1877F2" },
    { name: "Diambil", value: funnel.picked, fill: "#10B981" },
  ];

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
      "Beasiswa Pending": acc["Beasiswa Pending"] + s.payments.scholarshipPending,
    }),
    { Lunas: 0, Cicilan: 0, "Belum Bayar": 0, "Beasiswa Pending": 0 }
  );
  const payData = [
    { name: "Lunas", value: pay.Lunas, fill: "#10B981" },
    { name: "Cicilan", value: pay.Cicilan, fill: "#1877F2" },
    { name: "Belum Bayar", value: pay["Belum Bayar"], fill: "#F59E0B" },
    { name: "Beasiswa Pending", value: pay["Beasiswa Pending"], fill: "#8B5CF6" },
  ];

  return (
    <div className="grid gap-4">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5">
        <div className="text-sm font-bold text-[#050505]">Alur Pemenuhan Gabungan</div>
        <div className="text-xs text-[#65676B] mb-3">
          {funnelTotal === 0 ? "Belum ada pesanan di semua sekolah." : `${funnelTotal} pesanan di ${summaries.length} sekolah`}
        </div>
        {funnelTotal > 0 && (
          <>
            <div className="h-4 rounded-full bg-[#F0F2F5] overflow-hidden flex">
              {funnelSegs.filter((s) => s.value > 0).map((s) => (
                <div
                  key={s.name}
                  title={`${s.name}: ${s.value}`}
                  style={{ width: `${(s.value / funnelTotal) * 100}%`, backgroundColor: s.fill }}
                />
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
              {funnelSegs.map((s) => (
                <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-[#65676B]">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.fill }} />
                  {s.name} <strong className="text-[#050505]">{s.value}</strong>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <AggregateDonut title="Kondisi Fisik Gabungan" subtitle="Stok satuan di semua sekolah" unit="eks" data={condData} />
        <AggregateDonut title="Pembayaran Gabungan" subtitle="Komposisi status bayar semua sekolah" unit="pesanan" data={payData} />
      </div>
    </div>
  );
}
