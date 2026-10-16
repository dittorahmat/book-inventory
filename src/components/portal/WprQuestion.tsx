import { formatRupiah } from "../../lib/transfer-pricing";
import { WPR_PRICE, WPR_TITLE } from "../../lib/wpr";

interface WprQuestionProps {
  hasTakenPackage: boolean | null;
  setHasTakenPackage: (val: boolean) => void;
  wprFee: number;
  wprLoading: boolean;
}

/** Pertanyaan paket + baris biaya WPR untuk order satuan buku. */
export function WprQuestion({ hasTakenPackage, setHasTakenPackage, wprFee, wprLoading }: WprQuestionProps) {
  return (
    <div className="p-4 bg-[#F7F8FA] border border-[#E4E6EB] rounded-2xl space-y-3">
      <div className="text-xs font-bold text-[#050505]">Apakah ananda sudah mengambil paket buku?</div>
      {wprLoading ? (
        <div className="text-xs text-[#65676B]">Memeriksa status paket...</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {([true, false] as const).map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => setHasTakenPackage(val)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all active:scale-[0.98] ${
                hasTakenPackage === val
                  ? "border-[#1877F2] bg-[#E7F3FF]/40 text-[#050505]"
                  : "border-[#E4E6EB] bg-white text-[#65676B] hover:border-[#CED0D4]"
              }`}
            >
              {val ? "Sudah" : "Belum"}
            </button>
          ))}
        </div>
      )}
      {hasTakenPackage === true ? (
        <p className="text-xs text-emerald-700 font-semibold">Paket tercatat — bebas biaya {WPR_TITLE}.</p>
      ) : (
        <div className="flex justify-between text-xs text-[#050505]">
          <span>{WPR_TITLE} (wajib, belum paket)</span>
          <span className="font-bold">{formatRupiah(wprFee || WPR_PRICE)}</span>
        </div>
      )}
      <p className="text-[10px] text-[#65676B]">
        *Verifikasi akhir oleh sistem: bila tidak ditemukan order paket, {WPR_TITLE} tetap ditagihkan.
      </p>
    </div>
  );
}
