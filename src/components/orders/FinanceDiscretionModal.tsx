import { useState } from "react";
import { X, ShieldAlert, CheckCircle2, Loader2, Percent, Award, Unlock } from "lucide-react";
import { postJson } from "../../lib/api";
import { formatRupiah } from "../../lib/transfer-pricing";

interface FinanceDiscretionModalProps {
  order: {
    id: string;
    orderNumber: string;
    studentName: string;
    totalAmount: number;
    paidAmount: number;
    paymentStatus: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function FinanceDiscretionModal({ order, onClose, onSuccess }: FinanceDiscretionModalProps) {
  const [discretionType, setDiscretionType] = useState<"discount" | "scholarship" | "handover_override">("discount");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discretionNotes, setDiscretionNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discretionNotes.trim()) {
      setErrorMsg("Alasan/catatan diskresi Finance wajib diisi.");
      return;
    }
    if (discretionType === "discount" && discountAmount <= 0) {
      setErrorMsg("Nominal potongan harga harus lebih besar dari 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await postJson(
        `/api/student-orders/${order.id}/discretion`,
        {
          discretionType,
          discountAmount,
          discretionNotes: discretionNotes.trim(),
        },
        "Gagal menerapkan diskresi Finance."
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menerapkan diskresi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E6EB]">
          <div>
            <h2 className="text-sm font-bold text-[#050505] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Diskresi Manual Finance
            </h2>
            <p className="text-xs text-[#65676B]">Pesanan: {order.orderNumber} &bull; {order.studentName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#65676B] hover:bg-[#F0F2F5] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
          <div className="font-semibold flex items-center justify-between">
            <span>Tagihan: {formatRupiah(order.totalAmount)}</span>
            <span>Terbayar: {formatRupiah(order.paidAmount)}</span>
          </div>
          <div className="text-[11px] text-amber-800">
            Sisa Piutang: {formatRupiah(Math.max(0, order.totalAmount - order.paidAmount))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#050505] block">Pilih Bentuk Diskresi</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDiscretionType("discount")}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  discretionType === "discount"
                    ? "border-[#1877F2] bg-[#E7F3FF]/40 text-[#1877F2]"
                    : "border-[#CED0D4] bg-white text-[#65676B] hover:bg-gray-50"
                }`}
              >
                <Percent className="w-4 h-4" />
                <span className="text-[11px] font-bold">Potong Harga</span>
              </button>

              <button
                type="button"
                onClick={() => setDiscretionType("scholarship")}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  discretionType === "scholarship"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-[#CED0D4] bg-white text-[#65676B] hover:bg-gray-50"
                }`}
              >
                <Award className="w-4 h-4" />
                <span className="text-[11px] font-bold">Gratis 100%</span>
              </button>

              <button
                type="button"
                onClick={() => setDiscretionType("handover_override")}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  discretionType === "handover_override"
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-[#CED0D4] bg-white text-[#65676B] hover:bg-gray-50"
                }`}
              >
                <Unlock className="w-4 h-4" />
                <span className="text-[11px] font-bold">Izin Ambil</span>
              </button>
            </div>
          </div>

          {discretionType === "discount" && (
            <div>
              <label className="text-xs font-semibold text-[#050505] block mb-1">
                Nominal Potongan Harga (Rp)
              </label>
              <input
                type="number"
                min={0}
                max={order.totalAmount}
                value={discountAmount === 0 ? "" : discountAmount}
                onChange={(e) => setDiscountAmount(parseInt(e.target.value) || 0)}
                placeholder="Contoh: 100000"
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-bold text-[#1877F2]"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-[#050505] block mb-1">
              Catatan / Alasan Diskresi (Wajib)
            </label>
            <textarea
              rows={2}
              required
              value={discretionNotes}
              onChange={(e) => setDiscretionNotes(e.target.value)}
              placeholder="Contoh: Acc dispensasi yayasan, sisa pembayaran di akhir bulan"
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E6EB]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#CED0D4] hover:bg-[#F0F2F5] active:scale-[0.98] rounded-xl text-xs font-semibold text-[#050505] transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Terapkan Diskresi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
