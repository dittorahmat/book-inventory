import { useState } from "react";
import { X, Printer } from "lucide-react";
import { postJson } from "../../lib/api";
import type { StudentOrder } from "./order-types";

interface OrderHandoverModalProps {
  order: StudentOrder;
  onClose: () => void;
  onSuccess: () => void;
}

export function OrderHandoverModal({ order, onClose, onSuccess }: OrderHandoverModalProps) {
  const [recipient, setRecipient] = useState(order.parentName || order.studentName);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isCodeMatched = confirmationCode.trim().toUpperCase() === order.orderNumber.trim().toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCodeMatched) {
      setErrorMsg("Kode verifikasi yang dimasukkan tidak cocok dengan No. Order / Bukti Pengambilan.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await postJson(
        `/api/student-orders/${order.id}/handover`,
        {
          recipientName: recipient,
          notes: notes.trim() || undefined,
        },
        "Gagal memproses serah terima buku"
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memproses serah terima");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#050505]">Konfirmasi Penyerahan Buku ke Siswa</h3>
          <button onClick={onClose} className="text-[#65676B] hover:text-[#050505]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl font-medium">
              {errorMsg}
            </div>
          )}
          <div className="bg-[#F0F2F5] p-3 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[#65676B]">Kode Bukti Pengambilan:</span>
              <span className="font-mono font-bold text-[#1877F2] text-xs bg-white px-2 py-0.5 rounded border border-[#CED0D4]">
                {order.orderNumber}
              </span>
            </div>
            <div>
              <span className="text-[#65676B]">Murid:</span>{" "}
              <span className="font-bold text-[#050505]">{order.studentName}</span>
            </div>
            <div>
              <span className="text-[#65676B]">Paket:</span>{" "}
              <span className="font-semibold text-[#050505]">{order.packageName}</span>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#050505]">
              Cross-check Kode Pengambilan * <span className="text-[10px] text-[#65676B]">(Sesuai WA murid)</span>
            </label>
            <input
              type="text"
              required
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl font-mono uppercase font-semibold text-[#1877F2]"
              placeholder="Ketik kode / no. order..."
            />
            {confirmationCode.trim() && (
              <p className={`text-[10px] mt-1 font-semibold ${isCodeMatched ? "text-emerald-600" : "text-red-500"}`}>
                {isCodeMatched ? "✓ Kode terverifikasi cocok!" : "✗ Kode tidak cocok dengan sistem"}
              </p>
            )}
          </div>
          <div>
            <label className="block font-semibold mb-1">Nama Penerima Buku (Orang Tua / Siswa)</label>
            <input
              type="text"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
              placeholder="Contoh: Hendra Wahyudi (Ayah)"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Catatan Serah Terima (Opsional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
              placeholder="Diserahkan dalam kondisi baik dan tersegel rapi..."
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F0F2F5] rounded-xl font-semibold text-[#65676B]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isCodeMatched}
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-50 text-white rounded-xl font-semibold flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Memproses..." : "Konfirmasi & Terbitkan SJ Serah-Terima"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
