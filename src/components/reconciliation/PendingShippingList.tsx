import { Truck } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { BranchChargeRow } from "../../lib/reconciliation-types";

const SOURCE_LABEL: Record<BranchChargeRow["sourceType"], string> = {
  book_order: "Pesanan buku",
  uniform_order: "Pesanan seragam",
};

/** Daftar kerja gudang: tagihan yang belum final karena ongkir belum diinput. */
export function PendingShippingList({ charges }: { charges: BranchChargeRow[] }) {
  if (charges.length === 0) {
    return (
      <section className="bg-white rounded-2xl border border-[#E4E6EB] px-4 sm:px-5 py-8 text-center">
        <Truck className="w-6 h-6 text-[#65676B] mx-auto mb-2" />
        <p className="text-sm font-semibold text-[#050505]">Tidak ada tagihan menunggu ongkir</p>
        <p className="text-xs text-[#65676B] mt-1">
          Semua tagihan sudah final, jadi tidak ada ongkir yang menggantung.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-[#E4E6EB] overflow-hidden">
      <header className="px-4 sm:px-5 py-3 border-b border-[#E4E6EB] flex items-center gap-2">
        <Truck className="w-4 h-4 text-[#1877F2]" />
        <h2 className="text-sm font-bold text-[#050505]">Menunggu ongkir ({charges.length})</h2>
      </header>
      <ul className="divide-y divide-[#E4E6EB]">
        {charges.map((charge) => (
          <li key={charge.id} className="px-4 sm:px-5 py-3 flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#050505]">{charge.chargeNumber}</p>
              <p className="text-[11px] text-[#65676B] mt-0.5">
                {SOURCE_LABEL[charge.sourceType]} · sejak {charge.chargeableAt.slice(0, 10)}
              </p>
            </div>
            <span className="text-xs font-bold text-[#050505] whitespace-nowrap">
              {formatRupiah(charge.goodsAmount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
