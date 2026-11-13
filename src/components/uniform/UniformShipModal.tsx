import { useState, useRef } from "react";
import { X, Truck, Upload, AlertCircle } from "lucide-react";
import type { UniformOrderRow } from "./uniform-admin-api";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";

interface UniformShipModalProps {
  isOpen: boolean;
  order: UniformOrderRow;
  isSubmitting?: boolean;
  onConfirm: (payload: { shippingResi: string; packagePhotoBase64?: string }) => Promise<void>;
  onCancel: () => void;
}

export function UniformShipModal({
  isOpen,
  order,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: UniformShipModalProps) {
  const [resi, setResi] = useState(order.shippingResi ?? "");
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFieldError("Berkas harus berupa gambar (JPG, PNG).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFieldError("Ukuran gambar maksimal 5 MB.");
      return;
    }

    setFieldError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPhotoBase64(base64);
      setPhotoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const cleanResi = resi.trim();
    if (!cleanResi) {
      setFieldError("Nomor resi kurir wajib diisi sebelum barang dikirim.");
      return;
    }

    try {
      await onConfirm({
        shippingResi: cleanResi,
        packagePhotoBase64: photoBase64,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Gagal menandai kiriman.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#050505] flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-[#1877F2]" />
              Konfirmasi Pengiriman Seragam
            </h3>
            <p className="text-[11px] text-[#65676B]">
              Order {order.orderNumber} · {order.studentName}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-[#65676B] hover:bg-[#F0F2F5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {submitError && <FormSummaryAlert errors={{ submit: submitError }} title="Gagal Mengirimkan" />}

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Nomor Resi Ekspedisi / Kurir <span className="text-rose-500">*</span>
            </label>
            <input
              value={resi}
              onChange={(e) => {
                setResi(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              placeholder="Contoh: JNE-990123 / SICEPAT-..."
              className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none transition-colors ${
                fieldError ? "border-rose-500 focus:border-rose-600" : "border-[#CED0D4] focus:border-[#1877F2]"
              }`}
            />
            {fieldError && <FormFieldFeedback error={fieldError} />}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Foto Bukti Paket & Resi (Opsional)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {photoPreview ? (
              <div className="relative rounded-xl border border-[#CED0D4] overflow-hidden bg-slate-50 p-2 flex items-center justify-between">
                <img src={photoPreview} alt="Preview Paket" className="h-16 w-16 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoBase64(undefined);
                    setPhotoPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-xs text-rose-600 hover:underline px-2 py-1"
                >
                  Hapus Foto
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-3 border border-dashed border-[#CED0D4] rounded-xl text-xs text-[#65676B] hover:bg-[#F0F2F5] hover:border-[#1877F2] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah Foto Paket (Kelihatan Resi)</span>
              </button>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-blue-950">
              <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
              Notifikasi WhatsApp Otomatis
            </div>
            <p>
              Saat tombol konfirmasi diklik, sistem otomatis mengirim pesan WhatsApp berisi nomor resi kurir dan panduan pelacakan ke orang tua siswa ({order.studentName}).
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E6EB]">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl border border-[#CED0D4] text-xs font-semibold text-[#050505] hover:bg-[#F0F2F5]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1877F2] text-white text-xs font-semibold hover:bg-[#1664D9] disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Mengirimkan…" : "Kirim Seragam"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface UniformConfirmReceiptModalProps {
  isOpen: boolean;
  orderNumber: string;
  studentName: string;
  isSubmitting?: boolean;
  onConfirm: (notes?: string) => Promise<void>;
  onCancel: () => void;
}

export function UniformConfirmReceiptModal({
  isOpen,
  orderNumber,
  studentName,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: UniformConfirmReceiptModalProps) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onConfirm(notes.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat konfirmasi penerimaan.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#050505]">Konfirmasi Paket Diterima</h3>
            <p className="text-[11px] text-[#65676B]">
              Order {orderNumber} · {studentName}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-[#65676B] hover:bg-[#F0F2F5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <FormSummaryAlert errors={{ receipt: error }} title="Gagal Mencatat Konfirmasi" />}

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Catatan Penerimaan (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Paket diterima satpam / orang tua mengonfirmasi barang pas."
              rows={3}
              className="w-full rounded-xl border border-[#CED0D4] p-3 text-xs focus:outline-none focus:border-[#1877F2]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E6EB]">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl border border-[#CED0D4] text-xs font-semibold text-[#050505] hover:bg-[#F0F2F5]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? "Menyimpan…" : "Simpan Konfirmasi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
