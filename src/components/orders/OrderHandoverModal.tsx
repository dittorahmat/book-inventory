import { useState } from "react";
import { X, Printer } from "lucide-react";
import { postJson } from "../../lib/api";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import { validateRequiredText } from "../../lib/form-validation";
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [attempted, setAttempted] = useState(false);

  const isCodeMatched = confirmationCode.trim().toUpperCase() === order.orderNumber.trim().toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    const errors: Record<string, string | undefined> = {};

    if (!confirmationCode.trim()) {
      errors.confirmationCode = "Cross-check kode pengambilan wajib diisi.";
    } else if (!isCodeMatched) {
      errors.confirmationCode = `Kode tidak cocok! Masukkan kode resmi: ${order.orderNumber}`;
    }

    const recipientCheck = validateRequiredText(recipient, "Nama Penerima Buku", 3);
    if (!recipientCheck.valid) {
      errors.recipient = recipientCheck.message;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

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
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl font-medium">
              {errorMsg}
            </div>
          )}
          <FormSummaryAlert errors={attempted ? fieldErrors : {}} />
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
              Cross-check Kode Pengambilan <span className="text-rose-600">*</span>{" "}
              <span className="text-[10px] text-[#65676B]">(Sesuai WA murid)</span>
            </label>
            <input
              type="text"
              value={confirmationCode}
              onChange={(e) => {
                setConfirmationCode(e.target.value);
                if (attempted) setFieldErrors((prev) => ({ ...prev, confirmationCode: undefined }));
              }}
              className={`w-full px-3 py-2 border rounded-xl font-mono uppercase font-semibold text-[#1877F2] transition-colors ${
                attempted && fieldErrors.confirmationCode
                  ? "border-rose-500 ring-1 ring-rose-200"
                  : "border-[#CED0D4]"
              }`}
              placeholder="Ketik kode / no. order..."
            />
            <FormFieldFeedback error={attempted ? fieldErrors.confirmationCode : undefined} />
            {confirmationCode.trim() && !fieldErrors.confirmationCode && (
              <p className={`text-[10px] mt-1 font-semibold ${isCodeMatched ? "text-emerald-600" : "text-amber-600"}`}>
                {isCodeMatched ? "✓ Kode terverifikasi cocok!" : "Peringatan: Kode belum cocok dengan sistem"}
              </p>
            )}
          </div>
          <div>
            <label className="block font-semibold mb-1">
              Nama Penerima Buku (Orang Tua / Siswa) <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                if (attempted) setFieldErrors((prev) => ({ ...prev, recipient: undefined }));
              }}
              className={`w-full px-3 py-2 border rounded-xl transition-colors ${
                attempted && fieldErrors.recipient
                  ? "border-rose-500 ring-1 ring-rose-200"
                  : "border-[#CED0D4]"
              }`}
              placeholder="Contoh: Hendra Wahyudi (Ayah)"
            />
            <FormFieldFeedback error={attempted ? fieldErrors.recipient : undefined} />
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
              disabled={isSubmitting}
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
