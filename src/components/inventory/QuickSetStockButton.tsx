import { useState, useRef } from "react";
import { Edit3, Check, X, Loader2 } from "lucide-react";
import { apiEnvelope } from "../../lib/api";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";

interface QuickSetStockProps {
  label: string;
  currentQuantity: number;
  reservedQuantity?: number;
  onSuccess: () => void;
  overrideEndpoint: string;
  payload: Record<string, unknown>;
}

export function QuickSetStockButton({
  label,
  currentQuantity,
  reservedQuantity = 0,
  onSuccess,
  overrideEndpoint,
  payload,
}: QuickSetStockProps) {
  const [open, setOpen] = useState(false);
  const [targetQuantity, setTargetQuantity] = useState(String(currentQuantity));
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    setTargetQuantity(String(currentQuantity));
    setServerError(null);
    setFieldError(null);
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setServerError(null);

    const qty = parseInt(targetQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      setFieldError("Jumlah stok harus angka minimal 0");
      inputRef.current?.focus();
      return;
    }

    if (reservedQuantity > 0 && qty < reservedQuantity) {
      setFieldError(`Stok tidak boleh lebih kecil dari alokasi pesanan aktif (${reservedQuantity})`);
      inputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiEnvelope<{ success: boolean; message?: string }>(overrideEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          targetQuantity: qty,
        }),
      });

      if (res.success) {
        setOpen(false);
        onSuccess();
      } else {
        setServerError(res.message || "Gagal mengubah stok");
        inputRef.current?.focus();
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Gagal mengubah stok");
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        title={`Set Stok Cepat: ${label}`}
        className="inline-flex items-center justify-center p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
      >
        <Edit3 className="w-3.5 h-3.5" />
      </button>
    );
  }

  const errorsMap: Record<string, string | undefined> = {};
  if (fieldError) errorsMap["stok"] = fieldError;
  if (serverError) errorsMap["server"] = serverError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-sm w-full p-5 text-left space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
              Mode Demo Override
            </span>
            <h4 className="text-sm font-bold text-[#050505] mt-1 line-clamp-1">{label}</h4>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[#65676B] hover:text-[#050505] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-[#65676B] mb-1">
              <span>Stok saat ini:</span>
              <span className="font-semibold text-[#050505]">{currentQuantity}</span>
            </div>
            {reservedQuantity > 0 && (
              <div className="flex justify-between text-xs text-amber-700 mb-1">
                <span>Alokasi pesanan aktif:</span>
                <span className="font-semibold">{reservedQuantity}</span>
              </div>
            )}
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Set Saldo Stok Baru:
            </label>
            <input
              ref={inputRef}
              type="number"
              min="0"
              value={targetQuantity}
              onChange={(e) => {
                setTargetQuantity(e.target.value);
                if (fieldError) setFieldError(null);
                if (serverError) setServerError(null);
              }}
              className={`w-full px-3 py-2 bg-white border rounded-lg text-sm text-[#050505] focus:outline-hidden transition-colors ${
                fieldError || serverError
                  ? "border-rose-500 focus:border-rose-500 bg-rose-50/20"
                  : "border-[#CED0D4] focus:border-[#1877F2]"
              }`}
              autoFocus
            />
            <FormFieldFeedback error={fieldError} />
          </div>

          <FormSummaryAlert errors={errorsMap} title="Penyesuaian Stok Ditolak" />

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-[#65676B] hover:bg-[#F0F2F5] rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1877F2] hover:bg-[#166FE5] rounded-lg inline-flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Simpan Stok
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
