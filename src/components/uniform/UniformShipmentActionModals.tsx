import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

interface UniformOngkirModalProps {
  isOpen: boolean;
  orderNumber: string;
  studentName: string;
  initialCost: string;
  initialResi: string;
  onSave: (cost: string, resi: string) => void;
  onCancel: () => void;
}

export function UniformOngkirModal({
  isOpen,
  orderNumber,
  studentName,
  initialCost,
  initialResi,
  onSave,
  onCancel,
}: UniformOngkirModalProps) {
  const [cost, setCost] = useState(initialCost);
  const [resi, setResi] = useState(initialResi);

  useEffect(() => {
    setCost(initialCost);
    setResi(initialResi);
  }, [initialCost, initialResi]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#050505]">Input Ongkos Kirim & Resi</h3>
            <p className="text-[11px] text-[#65676B]">
              Order {orderNumber} · {studentName}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="p-1 rounded-lg text-[#65676B] hover:bg-[#F0F2F5]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Ongkir (Rp)</label>
            <input
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              type="number"
              min={0}
              placeholder="Misal: 15000"
              className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs focus:outline-none focus:border-[#1877F2]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">No. Resi (Opsional)</label>
            <input
              value={resi}
              onChange={(e) => setResi(e.target.value)}
              placeholder="Misal: JNE-990123"
              className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs focus:outline-none focus:border-[#1877F2]"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#E4E6EB] bg-[#F0F2F5]/50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-[#CED0D4] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onSave(cost, resi)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 active:scale-[0.98]"
          >
            Simpan Ongkir
          </button>
        </div>
      </div>
    </div>
  );
}

interface UniformCashierPayModalProps {
  isOpen: boolean;
  orderNumber: string;
  studentName: string;
  busy: boolean;
  onSave: (transfer: string, allocation: string, bank: string) => void;
  onCancel: () => void;
}

export function UniformCashierPayModal({
  isOpen,
  orderNumber,
  studentName,
  busy,
  onSave,
  onCancel,
}: UniformCashierPayModalProps) {
  const [transfer, setTransfer] = useState("");
  const [allocation, setAllocation] = useState("");
  const [bank, setBank] = useState("TUNAI");
  const [error, setError] = useState<string | null>(null);
  const transferInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!transfer || Number(transfer) <= 0) {
      setError("Nominal transfer wajib diisi lebih dari 0.");
      transferInputRef.current?.focus();
      return;
    }
    setError(null);
    onSave(transfer, allocation || transfer, bank);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#050505]">Input Pembayaran Manual Kasir</h3>
            <p className="text-[11px] text-[#65676B]">
              Order {orderNumber} · {studentName}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="p-1 rounded-lg text-[#65676B] hover:bg-[#F0F2F5]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Nominal Transfer (Rp) *</label>
            <input
              ref={transferInputRef}
              type="number"
              min={1}
              value={transfer}
              onChange={(e) => {
                setTransfer(e.target.value);
                setError(null);
              }}
              placeholder="Contoh: 150000"
              className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs focus:outline-none focus:border-[#1877F2]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Alokasi Tagihan (Rp)</label>
            <input
              type="number"
              min={1}
              value={allocation}
              onChange={(e) => setAllocation(e.target.value)}
              placeholder="Kosongkan jika sama dengan nominal transfer"
              className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs focus:outline-none focus:border-[#1877F2]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Metode / Bank</label>
            <input
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="TUNAI / BCA / MANDIRI"
              className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-xs focus:outline-none focus:border-[#1877F2]"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#E4E6EB] bg-[#F0F2F5]/50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-[#CED0D4] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleSubmit}
            className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
          >
            {busy ? "Menyimpan…" : "Simpan Pembayaran"}
          </button>
        </div>
      </div>
    </div>
  );
}
