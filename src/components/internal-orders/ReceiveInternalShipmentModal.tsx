import { useState } from "react";
import { PackageCheck, X } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { postJson } from "../../lib/api";
import type { InternalShipment } from "../../lib/internal-orders-types";

interface ReceiveInternalShipmentModalProps {
  shipment: InternalShipment;
  onClose: () => void;
  onReceived: () => void | Promise<void>;
}

const CONDITION_LABELS: Record<string, string> = { good: "Baik", damaged: "Rusak", missing: "Hilang" };

/** Penerimaan SJ Internal oleh cabang: kondisi per baris + penyesuaian selisih otomatis. */
export function ReceiveInternalShipmentModal({ shipment, onClose, onReceived }: ReceiveInternalShipmentModalProps) {
  const [conditions, setConditions] = useState<Record<string, string>>(() =>
    Object.fromEntries(shipment.items.map((i) => [i.id, "good"]))
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [transferShipmentId, setTransferShipmentId] = useState("");
  const [deliveryProofUrl, setDeliveryProofUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDeliveryProofUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryProofUrl.trim()) {
      alert("Wajib mengunggah atau menyertakan URL/bukti dokumen Surat Jalan yang sudah ditandatangani dan dicap.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await postJson<{ shipmentId: string; status: string }>(
        `/api/internal-orders/shipments/${encodeURIComponent(shipment.id)}/receive`,
        {
          transferShipmentId: transferShipmentId.trim() || undefined,
          deliveryProofUrl: deliveryProofUrl.trim(),
          items: shipment.items.map((i) => ({
            shipmentItemId: i.id,
            condition: conditions[i.id] ?? "good",
            notes: notes[i.id]?.trim() || undefined,
          })),
        },
        "Gagal mencatat penerimaan"
      );
      alert(
        result.status === "discrepancy"
          ? `Diterima dengan selisih — tercatat untuk penyesuaian.`
          : `SJ Internal ${shipment.deliveryNoteNumber} diterima.`
      );
      await onReceived();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mencatat penerimaan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E4E6EB] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E4E6EB] px-6 py-4">
          <div>
            <h3 className="text-sm font-bold text-[#050505]">Terima SJ Internal {shipment.deliveryNoteNumber}</h3>
            <p className="text-[11px] text-[#65676B]">Cek kondisi tiap baris — baris tak-baik menandai selisih</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#65676B] hover:bg-[#F0F2F5] hover:text-[#050505]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-[#050505]">
              Upload Dokumen Surat Jalan Bertanda Tangan & Cap <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              required
              onChange={handleFileUpload}
              className="w-full text-xs text-[#65676B] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#1877F2] file:text-white hover:file:bg-[#166FE5]"
            />
            {deliveryProofUrl ? (
              <p className="mt-1 text-[11px] font-semibold text-emerald-600">
                ✓ Berkas Surat Jalan bertanda tangan telah siap diunggah
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-[#65676B]">
                Wajib unggah scan/foto dokumen Surat Jalan yang sudah ditandatangani dan dicap oleh kepala sekolah/staf cabang.
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#050505]">ID Transfer Fisik Tertaut (Opsional)</label>
            <input
              type="text"
              placeholder="Kosongkan bila pengiriman fisik belum dibuat"
              value={transferShipmentId}
              onChange={(e) => setTransferShipmentId(e.target.value)}
              className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-[#050505]"
            />
          </div>
          <div>
            <span className="mb-2 block font-semibold text-[#050505]">Kondisi per baris:</span>
            <div className="max-h-56 space-y-2.5 overflow-y-auto">
              {shipment.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#CED0D4] bg-white p-3">
                  <div className="font-bold text-[#050505]">
                    {item.packageName ?? item.bookTitle ?? "Item"} × {item.quantity}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <SearchableSingleSelect
                      options={Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label }))}
                      value={conditions[item.id] ?? "good"}
                      onChange={(v) => setConditions({ ...conditions, [item.id]: v })}
                      placeholder="Kondisi..."
                    />
                    <input
                      type="text"
                      placeholder="Catatan baris (opsional)"
                      value={notes[item.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-[#CED0D4] px-2.5 py-1.5 text-[#050505]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl bg-[#F0F2F5] px-4 py-2 font-semibold text-[#65676B] hover:bg-[#E4E6EB] active:scale-[0.98]">
              Batal
            </button>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5 rounded-xl bg-[#1877F2] px-4 py-2 font-semibold text-white shadow-2xs hover:bg-[#166FE5] active:scale-[0.98] disabled:opacity-50">
              <PackageCheck className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Menyimpan..." : "Konfirmasi Terima"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
