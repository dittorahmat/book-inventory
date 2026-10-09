import { useState, useEffect } from "react";
import { AlertCircle, PackageCheck, X, FileText } from "lucide-react";
import { postJson, getJson } from "../../lib/api";
import type { PurchaseOrder } from "./procurement-types";

interface ReceivingModalProps {
  po: PurchaseOrder;
  onClose: () => void;
  onReceived: () => void | Promise<void>;
}

/** Modal penerimaan fisik inbound: input jumlah diterima per item PO dengan No Surat Jalan. */
export function ReceivingModal({ po, onClose, onReceived }: ReceivingModalProps) {
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [receivingNotes, setReceivingNotes] = useState("");
  const [receiptHistory, setReceiptHistory] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    po.items.forEach((item) => {
      initial[item.id] = Math.max(0, item.quantityOrdered - item.quantityReceived);
    });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getJson<any[]>(`/api/procurement/purchase-orders/${po.id}/receipts`)
      .then(setReceiptHistory)
      .catch(() => {});
  }, [po.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryNoteNumber.trim()) {
      alert("Nomor Surat Jalan supplier wajib diisi.");
      return;
    }
    const receivedItems = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([poItemId, quantityToReceive]) => ({ poItemId, quantityToReceive }));
    if (receivedItems.length === 0) {
      alert("Pilih minimal 1 item untuk diterima.");
      return;
    }
    setIsSubmitting(true);
    try {
      await postJson(
        `/api/procurement/purchase-orders/${po.id}/receive`,
        {
          deliveryNoteNumber: deliveryNoteNumber.trim(),
          notes: receivingNotes.trim() || undefined,
          receivedItems,
        },
        "Gagal mencatat penerimaan"
      );
      await onReceived();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#050505]">Penerimaan Barang Fisik (Inbound Receiving)</h3>
            <p className="text-[11px] text-[#65676B]">Otomatis buat barcode fisik & tambahkan ke stok satuan</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#65676B] hover:text-[#050505] p-1 rounded-lg hover:bg-[#F0F2F5]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="bg-[#F0F2F5] p-3 rounded-xl flex justify-between">
            <span>No. PO: <strong className="font-mono">{po.poNumber}</strong></span>
            <span>Supplier: <strong>{po.supplierName}</strong></span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-[#050505]">
                No. Surat Jalan Supplier (Wajib)
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: SJ-2026/09/001"
                value={deliveryNoteNumber}
                onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl font-medium text-[#050505]"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-[#050505]">
                Catatan Penerimaan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Dus kondisi baik / Pengiriman tahap 1"
                value={receivingNotes}
                onChange={(e) => setReceivingNotes(e.target.value)}
                className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl text-[#050505]"
              />
            </div>
          </div>

          {receiptHistory.length > 0 && (
            <div className="p-3 bg-gray-50 border border-[#CED0D4] rounded-xl space-y-2">
              <div className="font-bold text-[#050505] flex items-center gap-1.5 text-[11px]">
                <FileText className="w-3.5 h-3.5 text-[#1877F2]" />
                Riwayat Surat Jalan Sebelumnya ({receiptHistory.length} kali pengiriman):
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {receiptHistory.map((rc: any) => (
                  <div key={rc.id} className="text-[11px] bg-white p-2 rounded-lg border border-[#E4E6EB]">
                    <div className="flex justify-between font-semibold text-[#050505]">
                      <span>SJ: {rc.deliveryNoteNumber}</span>
                      <span className="text-[#65676B]">{rc.receivedDate}</span>
                    </div>
                    <div className="text-[10px] text-[#65676B] mt-0.5">
                      Item: {rc.items?.map((it: any) => `${it.title} (${it.quantityReceived} eks)`).join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold mb-2 text-[#050505]">
              Input Jumlah Buku yang Diterima Hari Ini:
            </label>
            <div className="space-y-2.5 max-h-56 overflow-y-auto">
              {po.items.map((it) => {
                const remaining = Math.max(0, it.quantityOrdered - it.quantityReceived);
                return (
                  <div
                    key={it.id}
                    className="p-3 bg-white border border-[#CED0D4] rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#050505] truncate">{it.title}</div>
                      <div className="text-[10px] text-[#65676B]">
                        Telah diterima: {it.quantityReceived} dari total {it.quantityOrdered} eks
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        placeholder="0"
                        value={(quantities[it.id] ?? 0) === 0 ? "" : quantities[it.id]}
                        onChange={(e) =>
                          setQuantities({ ...quantities, [it.id]: parseInt(e.target.value) || 0 })
                        }
                        className="w-20 px-2.5 py-1.5 border border-[#CED0D4] rounded-lg text-center font-bold text-[#1877F2]"
                      />
                      <span className="text-[11px] text-[#65676B]">/ max {remaining}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2 text-[11px]">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#1877F2] mt-0.5" />
            <span>
              Buku yang dikonfirmasi akan langsung otomatis dibuatkan ID barcode lepasan dengan kondisi <strong>Baru (new)</strong> di gudang <strong>{po.schoolName}</strong>.
            </span>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] rounded-xl font-semibold text-[#65676B] transition-colors active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-[0.98] disabled:opacity-50"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Menyimpan..." : "Konfirmasi Masuk Stok Satuan"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
