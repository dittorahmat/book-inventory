import { useState } from "react";
import { X, RotateCcw, Plus, Trash2, AlertCircle } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { Supplier, PurchaseOrder } from "./procurement-types";
import type { Book } from "../../types";
import type { CreateVendorReturnInput } from "./vendor-returns-types";
import { postJson } from "../../lib/api";

interface CreateVendorReturnModalProps {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  catalogBooks: Book[];
  onClose: () => void;
  onCreated: () => void;
}

interface ReturnItemDraft {
  bookId: string;
  quantity: number;
  reason: string;
}

export function CreateVendorReturnModal({
  suppliers,
  purchaseOrders,
  catalogBooks,
  onClose,
  onCreated,
}: CreateVendorReturnModalProps) {
  const [supplierId, setSupplierId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [creditNoteAmount, setCreditNoteAmount] = useState(0);
  const [items, setItems] = useState<ReturnItemDraft[]>([
    { bookId: "", quantity: 1, reason: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const poOptions = [
    { value: "", label: "Tanpa Purchase Order (Umum)" },
    ...purchaseOrders
      .filter((p) => !supplierId || p.supplierId === supplierId)
      .map((p) => ({ value: p.id, label: `${p.poNumber} - ${p.supplierName}` })),
  ];
  const bookOptions = catalogBooks.map((b) => ({
    value: b.id,
    label: `${b.title} (${b.isbn})`,
  }));

  const addItem = () => {
    setItems((prev) => [...prev, { bookId: "", quantity: 1, reason: "" }]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<ReturnItemDraft>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError("Supplier wajib dipilih");
      return;
    }
    if (!reason || reason.trim().length < 3) {
      setError("Alasan retur minimal 3 karakter");
      return;
    }
    const validItems = items.filter((it) => it.bookId && it.quantity > 0);
    if (validItems.length === 0) {
      setError("Minimal 1 buku dengan kuantitas > 0 wajib dipilih");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: CreateVendorReturnInput = {
        supplierId,
        purchaseOrderId: purchaseOrderId || undefined,
        reason: reason.trim(),
        creditNoteAmount: Number(creditNoteAmount) || 0,
        items: validItems.map((it) => ({
          bookId: it.bookId,
          quantity: it.quantity,
          reason: it.reason.trim() || undefined,
        })),
      };

      await postJson("/api/vendor-returns", payload, "Gagal membuat retur vendor.");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat retur vendor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl border border-[#CED0D4] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-[#E4E6EB] px-5 py-4">
          <div className="flex items-center gap-2 text-[#050505]">
            <RotateCcw className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-bold">Buat Retur Vendor (RTV)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#65676B] hover:bg-[#F0F2F5]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Supplier <span className="text-red-500">*</span>
            </label>
            <SearchableSingleSelect
              options={supplierOptions}
              value={supplierId}
              onChange={(val) => {
                setSupplierId(val);
                setPurchaseOrderId("");
              }}
              placeholder="Pilih Supplier..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Purchase Order Terkait (Opsional)
            </label>
            <SearchableSingleSelect
              options={poOptions}
              value={purchaseOrderId}
              onChange={setPurchaseOrderId}
              placeholder="Pilih PO..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Alasan Retur <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="mis. Buku cacat / cetakan rusak"
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Nominal Nota Kredit (Credit Note Rp)
              </label>
              <input
                type="number"
                min="0"
                value={creditNoteAmount}
                onChange={(e) => setCreditNoteAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#E4E6EB]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#050505]">Daftar Buku Diretur</span>
              <button
                type="button"
                onClick={addItem}
                className="text-xs font-semibold text-[#1877F2] hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Buku</span>
              </button>
            </div>

            {items.map((it, idx) => (
              <div
                key={idx}
                className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E4E6EB] space-y-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <SearchableSingleSelect
                      options={bookOptions}
                      value={it.bookId}
                      onChange={(val) => updateItem(idx, { bookId: val })}
                      placeholder="Pilih Judul Buku..."
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(idx, {
                          quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      placeholder="Qty"
                      className="w-full px-2 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505] text-center"
                    />
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Hapus baris"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={it.reason}
                  onChange={(e) => updateItem(idx, { reason: e.target.value })}
                  placeholder="Keterangan per buku (opsional, mis. sampul robek)"
                  className="w-full px-2.5 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505]"
                />
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[#E4E6EB] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#F0F2F5] hover:bg-[#E4E6EB] text-xs font-semibold text-[#65676B]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Retur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
