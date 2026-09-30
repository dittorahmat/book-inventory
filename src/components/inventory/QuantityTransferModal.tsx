import { useState } from "react";
import { X, Truck } from "lucide-react";
import { School } from "../../types";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { LooseSummaryRow, PackageSummaryRow } from "../../types/stock-summary";

export interface TransferLinePreview {
  key: string;
  label: string;
  quantity: number;
  unitPrice: number;
}

interface QuantityTransferModalProps {
  open: boolean;
  fromSchool: School | null;
  destinations: School[];
  lines: TransferLinePreview[];
  onClose: () => void;
  onCreated: () => void;
}

const inputClass =
  "w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]";

/** Pembuatan transfer berbasis kuantitas; identitas fisik dipilih server (FIFO). */
export function QuantityTransferModal({
  open,
  fromSchool,
  destinations,
  lines,
  onClose,
  onCreated,
}: QuantityTransferModalProps) {
  const [destinationId, setDestinationId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const totalValue = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromSchool) return;
    if (!destinationId) {
      setError("Pilih lokasi tujuan transfer.");
      return;
    }
    if (lines.length === 0) {
      setError("Isi kuantitas minimal satu baris sebelum membuat transfer.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const items = lines.map((line) => {
        const [kind, id] = line.key.split(":");
        return kind === "package"
          ? { itemType: "package" as const, packageId: id, quantity: line.quantity }
          : { itemType: "loose" as const, bookId: id, quantity: line.quantity };
      });

      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSchoolId: fromSchool.id,
          toSchoolId: destinationId,
          items,
          reason: reason.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal membuat draf transfer.");
      }
      alert(
        `Draf transfer ${data.data.shipmentNumber} dibuat. ${totalQty} unit dialokasikan otomatis dari stok tertua. Nilai: ${formatRupiah(
          data.data.totalDeclaredValue || totalValue
        )}`
      );
      setReason("");
      setNotes("");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat draf transfer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const available = destinations.filter((d) => d.id !== fromSchool?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        <header className="px-5 py-3.5 border-b border-[#E4E6EB] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#1877F2]" />
            <div>
              <h3 className="text-sm font-bold text-[#050505]">Buat Transfer Kuantitas</h3>
              <p className="text-[11px] text-[#65676B]">Eksemplar fisik dipilih otomatis dari stok tertua.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Tutup"
            className="p-1.5 rounded-lg hover:bg-[#F0F2F5] text-[#65676B]"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Tujuan Transfer *</label>
            <select required className={inputClass} value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
              <option value="">Pilih lokasi tujuan...</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.type === "main" ? "Pusat" : s.type === "warehouse" ? "Gudang" : "Cabang"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="block text-xs font-semibold text-[#050505] mb-1">Baris Transfer</p>
            <div className="divide-y divide-[#E4E6EB] border border-[#E4E6EB] rounded-lg">
              {lines.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[#65676B]">Belum ada baris. Isi kuantitas pada tabel stok.</p>
              ) : (
                lines.map((line) => (
                  <div key={line.key} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                    <span className="text-[#050505] truncate">{line.label}</span>
                    <span className="text-[#65676B] shrink-0">
                      {line.quantity} &times; {formatRupiah(line.unitPrice)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <p className="text-[11px] text-[#65676B] mt-1">
              Total: <span className="font-bold text-[#050505]">{totalQty} unit</span> &bull; nilai estimasi{" "}
              {formatRupiah(totalValue)}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Alasan (opsional)</label>
            <input
              className={inputClass}
              placeholder="Contoh: Pengisian stok cabang"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Catatan (opsional)</label>
            <textarea
              rows={2}
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="pt-2 flex justify-end gap-2 border-t border-[#E4E6EB]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] rounded-xl font-semibold text-[#65676B] text-xs transition-colors active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || lines.length === 0}
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold text-xs transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? "Membuat..." : "Buat Draf Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export type { LooseSummaryRow, PackageSummaryRow };
