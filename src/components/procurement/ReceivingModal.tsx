import { useState } from "react";
import { AlertCircle, PackageCheck, X } from "lucide-react";
import { postJson } from "../../lib/api";
import type { PurchaseOrder } from "./procurement-types";

interface ReceivingModalProps {
  po: PurchaseOrder;
  onClose: () => void;
  onReceived: () => void | Promise<void>;
}

/** Modal penerimaan fisik inbound: input jumlah diterima per item PO. */
export function ReceivingModal({ po, onClose, onReceived }: ReceivingModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    po.items.forEach((item) => {
      initial[item.id] = Math.max(0, item.quantityOrdered - item.quantityReceived);
    });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        { receivedItems },
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
