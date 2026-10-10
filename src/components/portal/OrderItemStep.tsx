import { Package, BookOpen, Minus, Plus, Lock } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { calcLooseOrderTotal, effectiveSellPrice } from "../../lib/book-pricing";
import type { SatuanBookOption } from "./portal-api";
import { PackageBreakdown, type BreakdownItem } from "./PackageBreakdown";

export interface LooseSelection {
  bookId: string;
  quantity: number;
}

interface OrderItemStepProps {
  /** true = mode paket (dikunci otomatis ke paket murid), false = mode satuan. */
  packageMode: boolean;
  canOrderSatuan: boolean;
  onModeChange: (packageMode: boolean) => void;
  books: SatuanBookOption[];
  selections: LooseSelection[];
  onQuantityChange: (bookId: string, quantity: number) => void;
  selectedPackagePrice: number;
  selectedPackageName: string | null;
  packageItems: BreakdownItem[];
  onContinue: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

const qtyClass =
  "w-14 px-2 py-1 bg-white border border-[#CED0D4] rounded-lg text-xs font-bold text-[#1877F2] text-center focus:outline-hidden focus:border-[#1877F2]";

/**
 * Langkah pemilihan item: paket terkunci atau buku satuan.
 * Pilihan satuan hanya ditampilkan saat periode satuan dibuka (spec: public-order-satuan).
 */
export function OrderItemStep({
  packageMode,
  canOrderSatuan,
  onModeChange,
  books,
  selections,
  onQuantityChange,
  selectedPackagePrice,
  selectedPackageName,
  packageItems,
  onContinue,
  onBack,
  isSubmitting,
}: OrderItemStepProps) {
  const totalQty = selections.reduce((s, sel) => s + sel.quantity, 0);
  const totalSatuan = calcLooseOrderTotal(selections, books);

  const canContinue = packageMode ? !!selectedPackageName : totalQty > 0;

  return (
    <div className="space-y-5">
      {canOrderSatuan && (
        <div className="inline-flex rounded-xl border border-[#CED0D4] overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => onModeChange(true)}
            className={`px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors active:scale-[0.98] ${
              packageMode ? "bg-[#1877F2] text-white" : "text-[#65676B] hover:bg-[#F0F2F5]"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Paket Lengkap</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange(false)}
            className={`px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border-l border-[#CED0D4] active:scale-[0.98] ${
              !packageMode ? "bg-[#1877F2] text-white" : "text-[#65676B] hover:bg-[#F0F2F5]"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Satuan</span>
          </button>
        </div>
      )}

      {packageMode ? (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#65676B]">Paket untuk murid</p>
          <p className="text-sm font-bold text-[#050505] mt-1">{selectedPackageName ?? "Paket tidak ditemukan"}</p>
          <p className="text-lg font-bold text-[#1877F2] mt-1">{formatRupiah(selectedPackagePrice)}</p>
          <p className="text-[11px] text-[#65676B] mt-2 inline-flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Paket dikunci sesuai kelas &amp; kurikulum murid.
          </p>
          <PackageBreakdown items={packageItems} />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#65676B]">Pilih Buku Satuan</p>
            <p className="text-[11px] text-[#65676B] mt-0.5">
              Total dihitung dari harga jual satuan per eksemplar.
            </p>
          </div>

          {books.length === 0 ? (
            <p className="text-xs text-[#65676B] bg-[#F0F2F5] border border-dashed border-[#CED0D4] rounded-xl px-4 py-6 text-center">
              Belum ada judul yang dapat dipesan satuan.
            </p>
          ) : (
            <ul className="divide-y divide-[#E4E6EB] bg-white rounded-2xl border border-[#E4E6EB]">
              {books.map((book) => {
                const sel = selections.find((s) => s.bookId === book.id);
                const qty = sel?.quantity ?? 0;
                return (
                  <li key={book.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#050505] truncate">{book.title}</div>
                      <div className="text-[11px] text-[#65676B]">
                        {book.author} &bull; {formatRupiah(effectiveSellPrice(book))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onQuantityChange(book.id, Math.max(0, qty - 1))}
                        disabled={qty === 0}
                        title="Kurangi"
                        className="p-1.5 rounded-lg border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors active:scale-[0.98] disabled:opacity-40"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        placeholder="0"
                        value={qty === 0 ? "" : qty}
                        onChange={(e) =>
                          onQuantityChange(book.id, Math.max(0, Math.min(50, Number(e.target.value) || 0)))
                        }
                        className={qtyClass}
                        aria-label={`Jumlah ${book.title}`}
                      />
                      <button
                        type="button"
                        onClick={() => onQuantityChange(book.id, Math.min(50, qty + 1))}
                        title="Tambah"
                        className="p-1.5 rounded-lg border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors active:scale-[0.98]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="bg-[#F0F2F5] rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-[#65676B]">
              {totalQty} eksemplar dipilih
            </span>
            <span className="text-base font-bold text-[#050505]">{formatRupiah(totalSatuan)}</span>
          </div>
        </div>
      )}

      <div className="flex justify-between gap-2 pt-2 border-t border-[#E4E6EB]">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#65676B] font-semibold text-xs transition-colors active:scale-[0.98]"
        >
          Kembali
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || isSubmitting}
          className="px-5 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold text-xs transition-colors active:scale-[0.98] disabled:opacity-50"
        >
          Lanjut ke Pembayaran
        </button>
      </div>
    </div>
  );
}
