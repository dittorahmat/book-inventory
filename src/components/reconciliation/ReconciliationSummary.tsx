import { AlertTriangle } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { KindSplit, ReconciliationResult } from "../../lib/reconciliation-types";

const splitAmount = (row: { goodsAmount: number; shippingAmount: number }): number =>
  row.goodsAmount + row.shippingAmount;

const splitHint = (split: KindSplit): string =>
  `Buku ${formatRupiah(splitAmount(split.buku))} · Seragam ${formatRupiah(splitAmount(split.seragam))}`;

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
      hint: `${data.charges.open.count} tagihan open · ${splitHint(data.charges.open.byKind)}`,
    },
    {
      label: "Tagihan final periode ini",
      value: formatRupiah(splitAmount(data.charges.final)),
      hint: `Barang ${formatRupiah(data.charges.final.goodsAmount)} · Ongkir ${formatRupiah(data.charges.final.shippingAmount)}`,
    },
    {
      label: "Pecahan tagihan final",
      value: splitHint(data.charges.final.byKind),
      hint: `${data.charges.final.byKind.buku.count} tagihan buku · ${data.charges.final.byKind.seragam.count} tagihan seragam`,
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
    {
      label: "Pecahan klaim",
      value: splitHint(data.claims.byKind),
      hint: `Ongkir buku ${formatRupiah(data.claims.byKind.buku.shippingAmount)} · Ongkir seragam ${formatRupiah(data.claims.byKind.seragam.shippingAmount)}`,
    },
  ];

  return (
    <section className="bg-white rounded-2xl border border-[#E4E6EB] overflow-hidden">
      <header className="px-4 sm:px-5 py-3 border-b border-[#E4E6EB]">
        <h2 className="text-sm font-bold text-[#050505]">Rekonsiliasi {data.period}</h2>
        <p className="text-xs text-[#65676B] mt-0.5">
          Uang masuk wali, tagihan gudang ke cabang, dan klaim — buku dan seragam bersebelahan.
        </p>
      </header>

      {data.claims.lockedDrift.count > 0 && (
        <div role="alert" className="mx-4 sm:mx-5 mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-amber-900">
            {data.claims.lockedDrift.count} klaim terkunci berubah setelah dikunci — selisih{" "}
            {formatRupiah(data.claims.lockedDrift.amount)} perlu diselesaikan di periode berikutnya.
          </p>
        </div>
      )}

      <dl className="divide-y divide-[#E4E6EB] mt-4">
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
