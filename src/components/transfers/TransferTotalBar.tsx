import { formatRupiah } from "../../lib/transfer-pricing";

interface TransferTotalBarProps {
  looseTotal: number;
  packageTotal: number;
}

export function TransferTotalBar({ looseTotal, packageTotal }: TransferTotalBarProps) {
  return (
    <div className="bg-[#E7F3FF] border border-[#1877F2]/20 rounded-xl px-3.5 py-2.5 space-y-1">
      <div className="flex items-center justify-between text-[11px] text-[#65676B] font-semibold">
        <span>Satuan</span>
        <span>{formatRupiah(looseTotal)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-[#65676B] font-semibold">
        <span>Paketan</span>
        <span>{formatRupiah(packageTotal)}</span>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-[#1877F2]/20">
        <span className="text-xs font-bold text-[#050505]">Total Nilai (harga saat kirim)</span>
        <span className="text-sm font-bold text-[#1877F2]">{formatRupiah(looseTotal + packageTotal)}</span>
      </div>
    </div>
  );
}
