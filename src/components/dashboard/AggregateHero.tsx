import type { DashboardTotal } from "../../lib/dashboard-types";
import { formatCount, formatRupiah } from "../../lib/transfer-pricing";

/** Strip KPI agregat lintas lokasi (include gudang): angka server, bukan hitung ulang klien. */
export function AggregateHero({ total }: { total: DashboardTotal }) {
  const stats = [
    { label: "Lokasi", value: formatCount(total.schools) },
    { label: "Satuan tersedia", value: formatCount(total.looseInStock) },
    { label: "Paket siap", value: formatCount(total.packagesReady) },
    { label: "Menunggu", value: formatCount(total.waitingOrders) },
    { label: "Tunggakan", value: formatRupiah(total.outstandingRp) },
  ];
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] px-5 py-4">
      <div className="text-sm font-bold text-[#050505]">Agregat Semua Lokasi</div>
      <div className="text-xs text-[#65676B]">Total gabungan sekolah dan gudang — klik kartu cabang untuk breakdown.</div>
      <dl className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-[#65676B]">{s.label}</dt>
            <dd className="text-lg font-black text-[#050505] truncate">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
