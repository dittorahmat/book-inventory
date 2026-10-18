import { formatRupiah } from "../../lib/transfer-pricing";
import type { ReconciliationResult } from "../../lib/reconciliation-types";

/** Presentasional murni (props masuk, tanpa fetch) supaya bisa diuji tanpa harness jaringan. */
export function ReconciliationSummary({ data }: { data: ReconciliationResult }) {
  const rows: Array<{ label: string; value: string; hint?: string }> = [
    {
      label: "Uang masuk dari wali",
      value: formatRupiah(data.moneyIn.amount),
      hint: `${data.moneyIn.receiptCount} struk terverifikasi`,
    },
    {
      label: "Alokasi ke order",
      value: formatRupiah(data.allocations.total),
      hint: `Buku ${formatRupiah(data.allocations.buku)} · Seragam ${formatRupiah(data.allocations.seragam)}`,
    },
    {
      label: "Belum dialokasikan",
      value: formatRupiah(data.unallocated.amount),
      hint: `${data.unallocated.receiptCount} struk perlu dibagi finance cabang`,
    },
    {
      label: "Tagihan cabang menunggu ongkir",
      value: formatRupiah(data.charges.open.goodsAmount),
      hint: `${data.charges.open.count} tagihan berstatus open`,
    },
    {
      label: "Tagihan final periode ini",
      value: formatRupiah(data.charges.final.goodsAmount + data.charges.final.shippingAmount),
      hint: `Barang ${formatRupiah(data.charges.final.goodsAmount)} · Ongkir ${formatRupiah(data.charges.final.shippingAmount)}`,
    },
    {
      label: "Belum masuk klaim",
      value: formatRupiah(data.unbilled.amount),
      hint: `${data.unbilled.count} tagihan final belum ditagihkan ke cabang`,
    },
    {
      label: "Klaim periode ini",
      value: formatRupiah(data.claims.totalAmount),
      hint: `Barang ${formatRupiah(data.claims.goodsAmount)} · Ongkir ${formatRupiah(data.claims.shippingAmount)}`,
    },
  ];

  return (
    <section className="bg-white rounded-2xl border border-[#E4E6EB] overflow-hidden">
      <header className="px-4 sm:px-5 py-3 border-b border-[#E4E6EB]">
        <h2 className="text-sm font-bold text-[#050505]">Rekonsiliasi {data.period}</h2>
        <p className="text-xs text-[#65676B] mt-0.5">
          Uang masuk wali, tagihan gudang ke cabang, dan klaim — satu layar.
        </p>
      </header>
      <dl className="divide-y divide-[#E4E6EB]">
        {rows.map((row) => (
          <div key={row.label} className="px-4 sm:px-5 py-3 flex items-baseline justify-between gap-4">
            <dt className="text-xs text-[#65676B]">
              {row.label}
              {row.hint && <span className="block text-[11px] text-[#65676B] mt-0.5">{row.hint}</span>}
            </dt>
            <dd className="text-sm font-bold text-[#050505] whitespace-nowrap">{row.value}</dd>
          </div>
        ))}
      </dl>
      <footer className="px-4 sm:px-5 py-3 border-t border-[#E4E6EB] flex items-baseline justify-between gap-4">
        <span className="text-xs font-semibold text-[#65676B]">Selisih uang masuk vs klaim</span>
        <span className={`text-sm font-bold ${data.difference === 0 ? "text-emerald-700" : "text-amber-700"}`}>
          {formatRupiah(data.difference)}
        </span>
      </footer>
    </section>
  );
}
