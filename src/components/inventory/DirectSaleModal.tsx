import { useState } from "react";
import { X, ShoppingBag, AlertCircle } from "lucide-react";
import type { School } from "../../types";
import { formatRupiah } from "../../lib/transfer-pricing";
import { postJson } from "../../lib/api";
import type { TransferLinePreview } from "./QuantityTransferModal";

interface DirectSaleModalProps {
  open: boolean;
  school: School | null;
  lines: TransferLinePreview[];
  onClose: () => void;
  onSuccess: () => void;
}

export function DirectSaleModal({
  open,
  school,
  lines,
  onClose,
  onSuccess,
}: DirectSaleModalProps) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [refNo, setRefNo] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const looseOnlyLines = lines.filter((l) => l.key.startsWith("loose:"));
  const totalQty = looseOnlyLines.reduce((s, l) => s + l.quantity, 0);
  const totalAmount = looseOnlyLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    if (looseOnlyLines.length === 0) {
      setError("Pilih minimal 1 judul buku satuan untuk dijual.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await postJson(
        "/api/direct-sales",
        {
          schoolId: school.id,
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim(),
          paymentMethod,
          referenceNumber: refNo.trim() || undefined,
          notes: notes.trim() || undefined,
          items: looseOnlyLines.map((l) => ({
            bookId: l.key.replace("loose:", ""),
            quantity: l.quantity,
          })),
        },
        "Gagal memproses transaksi penjualan langsung"
      );

      alert(`Penjualan langsung senilai ${formatRupiah(totalAmount)} berhasil!`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#050505] flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-[#1877F2]" />
              Kasir Penjualan Satuan ke Ortu (HQ)
            </h3>
            <p className="text-xs text-[#65676B]">Memotong stok satuan non-paket di {school?.name}</p>
          </div>
          <button onClick={onClose} className="text-[#65676B] hover:text-[#050505]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[#050505] font-semibold mb-1">Nama Orang Tua / Pembeli</label>
            <input
              type="text"
              required
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Contoh: Ibu Rina Kartika"
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-[#050505] font-semibold mb-1">No. WhatsApp / Telepon</label>
            <input
              type="text"
              required
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#050505] font-semibold mb-1">Metode Bayar</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as "cash" | "transfer")}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs"
              >
                <option value="cash">Tunai (Cash)</option>
                <option value="transfer">Transfer Bank / QRIS</option>
              </select>
            </div>
            <div>
              <label className="block text-[#050505] font-semibold mb-1">No. Ref / Struk</label>
              <input
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="Opsional"
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#050505] font-semibold mb-1">Catatan Tambahan</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pembelian buku susulan semester 1"
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-[#050505] font-semibold mb-1">Daftar Buku yang Dibeli ({totalQty} eks)</label>
            <div className="bg-[#F0F2F5] rounded-xl p-3 space-y-2 max-h-36 overflow-y-auto">
              {looseOnlyLines.length === 0 ? (
                <p className="text-gray-500 italic">Pilih kuantitas pada buku satuan di tabel stok.</p>
              ) : (
                looseOnlyLines.map((l) => (
                  <div key={l.key} className="flex justify-between items-center text-xs">
                    <span className="text-[#050505] truncate max-w-[240px]">{l.label}</span>
                    <span className="font-semibold text-[#050505]">
                      {l.quantity} &times; {formatRupiah(l.unitPrice)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#E7F3FF] p-3 rounded-xl flex justify-between items-center border border-[#1877F2]/20">
            <span className="font-semibold text-[#1877F2]">Total Pembayaran:</span>
            <span className="text-sm font-bold text-[#1877F2]">{formatRupiah(totalAmount)}</span>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#65676B] font-semibold text-xs active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || looseOnlyLines.length === 0}
              className="px-5 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-50 text-white font-semibold text-xs active:scale-[0.98]"
            >
              {isSubmitting ? "Memproses..." : "Selesaikan Transaksi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
