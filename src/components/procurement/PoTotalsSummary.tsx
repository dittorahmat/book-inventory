interface PoTotalsSummaryProps {
  gross: number;
  discount: number;
  net: number;
  totalQty: number;
}

function rupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

/** Ringkasan tiga angka PO: total kotor, total diskon, total netto. Baris datar, tanpa kartu bertumpuk. */
export function PoTotalsSummary({ gross, discount, net, totalQty }: PoTotalsSummaryProps) {
  return (
    <div className="bg-[#F0F2F5] p-3 rounded-xl">
      <div className="divide-y divide-[#E4E6EB] text-xs">
        <div className="flex items-center justify-between py-1">
          <span className="text-[#65676B]">Total Kotor</span>
          <span className="font-semibold text-[#050505]">{rupiah(gross)}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[#65676B]">Total Diskon</span>
          <span className="font-semibold text-emerald-600">− {rupiah(discount)}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="font-bold text-[#050505]">Total Netto</span>
          <span className="text-base font-bold text-[#050505]">{rupiah(net)}</span>
        </div>
      </div>
      <span className="text-[10px] text-[#65676B] mt-1 block">
        Total: {totalQty} eksemplar
      </span>
    </div>
  );
}
