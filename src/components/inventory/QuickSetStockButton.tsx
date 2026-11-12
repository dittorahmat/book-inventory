import { useState } from "react";
import { Edit3, Check, X, AlertTriangle } from "lucide-react";
import { apiEnvelope } from "../../lib/api";

interface QuickSetStockProps {
  label: string;
  currentQuantity: number;
  onSuccess: () => void;
  overrideEndpoint: string;
  payload: Record<string, unknown>;
}

export function QuickSetStockButton({
  label,
  currentQuantity,
  onSuccess,
  overrideEndpoint,
  payload,
}: QuickSetStockProps) {
  const [open, setOpen] = useState(false);
  const [targetQuantity, setTargetQuantity] = useState(String(currentQuantity));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    setTargetQuantity(String(currentQuantity));
    setError(null);
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(targetQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      setError("Jumlah stok harus angka minimal 0");
      return;
    }

    setSubmitting(true);
    setError(null);
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
        setError(res.message || "Gagal mengubah stok");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengubah stok");
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
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Set Saldo Stok Baru:
            </label>
            <input
              type="number"
              min="0"
              value={targetQuantity}
              onChange={(e) => setTargetQuantity(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-sm text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

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
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1877F2] hover:bg-[#166FE5] rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {submitting ? "Menyimpan..." : "Simpan Stok"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
