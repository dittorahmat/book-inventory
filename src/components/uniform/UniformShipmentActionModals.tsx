import { useState } from "react";

interface UniformOngkirFormProps {
  initialCost: string;
  initialResi: string;
  onSave: (cost: string, resi: string) => void;
  onCancel: () => void;
}

export function UniformOngkirForm({
  initialCost,
  initialResi,
  onSave,
  onCancel,
}: UniformOngkirFormProps) {
  const [cost, setCost] = useState(initialCost);
  const [resi, setResi] = useState(initialResi);

  return (
    <div className="p-4 bg-white rounded-2xl border border-blue-200 shadow-sm space-y-3 animate-fadeIn">
      <div className="text-xs font-bold text-[#050505]">Input Ongkos Kirim & Resi Ekspedisi</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#65676B] mb-1">Ongkir (Rp)</label>
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            type="number"
            min={0}
            placeholder="Misal: 15000"
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#65676B] mb-1">No. Resi (Opsional)</label>
          <input
            value={resi}
            onChange={(e) => setResi(e.target.value)}
            placeholder="Misal: JNE-990123"
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(cost, resi)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 active:scale-[0.98]"
        >
          Simpan Ongkir
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-[#F0F2F5] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

interface UniformCashierPayFormProps {
  busy: boolean;
  onSave: (transfer: string, allocation: string, bank: string) => void;
  onCancel: () => void;
}

export function UniformCashierPayForm({ busy, onSave, onCancel }: UniformCashierPayFormProps) {
  const [transfer, setTransfer] = useState("");
  const [allocation, setAllocation] = useState("");
  const [bank, setBank] = useState("TUNAI");

  return (
    <div className="p-4 bg-white rounded-2xl border border-blue-200 shadow-sm space-y-3 animate-fadeIn">
      <div className="text-xs font-bold text-[#050505]">Input Pembayaran Manual Kasir</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#65676B] mb-1">Nominal Transfer (Rp)</label>
          <input
            type="number"
            min={1}
            value={transfer}
            onChange={(e) => setTransfer(e.target.value)}
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#65676B] mb-1">Alokasi Tagihan (Rp)</label>
          <input
            type="number"
            min={1}
            value={allocation}
            onChange={(e) => setAllocation(e.target.value)}
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#65676B] mb-1">Metode / Bank</label>
          <input
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(transfer, allocation, bank)}
          className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
        >
          {busy ? "Menyimpan…" : "Simpan Pembayaran"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-[#F0F2F5] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
