import type { DashboardCoverage, DashboardPayments, DashboardStock } from "../../lib/dashboard-types";
import { coverageTone } from "./coverage-tone";
import { formatRupiah } from "../../lib/transfer-pricing";

interface DashboardKpisProps {
  coverage: DashboardCoverage;
  stock: DashboardStock;
  payments: DashboardPayments;
}

export function DashboardKpis({ coverage, stock, payments }: DashboardKpisProps) {
  const tone = coverageTone(coverage.ratio);
  const display = coverage.ratio === null ? 100 : Math.min(100, Math.round(coverage.ratio * 100));
  const status = coverage.ratio === null || coverage.ratio >= 1 ? "Siap Layani" : coverage.shortfall > 0 ? `Kurang ${coverage.shortfall} paket` : "Perlu Perhatian";

  const rows: Array<{ label: string; value: string; sub?: string }> = [
    { label: "Paket Siap", value: String(coverage.readyPackages), sub: `${coverage.waitingOrders} pesanan menunggu` },
    { label: "Stok Satuan", value: String(stock.looseInStock), sub: `${stock.inTransit} dalam perjalanan` },
    { label: "Tunggakan", value: formatRupiah(payments.outstandingRp), sub: `${payments.unpaidCount} pesanan belum lunas` },
    { label: "Beasiswa Pending", value: String(payments.scholarshipPending), sub: "menunggu persetujuan" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[#65676B]">Cakupan Kesiapan</div>
          <div className={`text-4xl font-bold tracking-tight ${tone.text}`}>{display}%</div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${tone.pill}`}>{status}</span>
      </div>
      <div className="h-2 mx-5 rounded-full bg-[#F0F2F5] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${display}%`, backgroundColor: tone.bar }} />
      </div>
      <dl className="mt-4 divide-y divide-[#E4E6EB] border-t border-[#E4E6EB]">
        {rows.map((r) => (
          <div key={r.label} className="px-5 py-3 flex items-center justify-between gap-3">
            <dt className="text-sm text-[#65676B]">{r.label}{r.sub ? <span className="block text-xs text-[#90949C]">{r.sub}</span> : null}</dt>
            <dd className="text-base font-bold text-[#050505] text-right">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
