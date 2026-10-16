import { useState } from "react";
import type { StudentOrder } from "./order-types";

interface ShippingModalProps {
  order: StudentOrder;
  onClose: () => void;
  onSave: (order: StudentOrder, shippingCost: number, shippingResi?: string) => Promise<void>;
}

/** Modal input ongkir manual gudang (syarat tombol kirim invoice). */
export function ShippingModal({ order, onClose, onSave }: ShippingModalProps) {
  const [cost, setCost] = useState(order.shippingCost ?? 0);
  const [resi, setResi] = useState(order.shippingResi ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(order, cost, resi.trim() || undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4">
        <h3 className="text-sm font-bold text-[#050505]">Input Ongkir — {order.orderNumber}</h3>
        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">Ongkir (Rp)</label>
          <input type="number" min={0} value={cost === 0 ? "" : cost} onChange={(e) => setCost(parseInt(e.target.value) || 0)} placeholder="0" className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl text-xs" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">No. Resi (opsional)</label>
          <input type="text" value={resi} onChange={(e) => setResi(e.target.value)} placeholder="RESI-..." className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl text-xs" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-[#F0F2F5] rounded-xl text-xs font-semibold active:scale-[0.98]">Batal</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 active:scale-[0.98]">
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
