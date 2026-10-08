import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { Book } from "../../types";
import { calcPoHeader, effectiveBookPrice } from "../../lib/book-pricing";
import { postJson } from "../../lib/api";
import { PoTotalsSummary } from "./PoTotalsSummary";
import { CreateSupplierModal } from "./CreateSupplierModal";
import type { NewPOItemInput, Supplier } from "./procurement-types";

interface CreatePOModalProps {
  suppliers: Supplier[];
  catalogBooks: Book[];
  defaultSupplierId: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
  reloadSuppliers: () => Promise<Supplier[]>;
}

const blankRow = (bookId: string, unitPrice: number, qty: number): NewPOItemInput => ({
  bookId,
  quantityOrdered: qty,
  unitPrice,
  discountPercent: 0,
});

/** Modal penerbitan PO: supplier, tanggal, item buku, ringkasan tiga angka. */
export function CreatePOModal({ suppliers, catalogBooks, defaultSupplierId, onClose, onCreated, reloadSuppliers }: CreatePOModalProps) {
  const [poSupplierId, setPoSupplierId] = useState(defaultSupplierId);
  const [poOrderDate, setPoOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [poExpectedArrival, setPoExpectedArrival] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poItems, setPoItems] = useState<NewPOItemInput[]>(() =>
    catalogBooks.length > 0
      ? [blankRow(catalogBooks[0].id, buyPriceOf(catalogBooks[0].id), 20)]
      : []
  );
  const [isSubmittingPO, setIsSubmittingPO] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  function buyPriceOf(bookId: string, fallback = 0): number {
    const b = catalogBooks.find((x) => x.id === bookId);
    return b ? effectiveBookPrice(b).buy : fallback;
  }

  const handleAddPOItemRow = () => {
    if (catalogBooks.length === 0) return;
    const defaultBook = catalogBooks[0];
    setPoItems((prev) => [...prev, blankRow(defaultBook.id, buyPriceOf(defaultBook.id), 10)]);
  };

  const handleRemovePOItemRow = (index: number) => {
    setPoItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdatePOItem = (index: number, field: keyof NewPOItemInput, val: any) => {
    setPoItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (field === "bookId") {
          return { ...item, bookId: val, unitPrice: buyPriceOf(val, 0) };
        }
        const num = Math.max(0, Number(val) || 0);
        if (field === "discountPercent") return { ...item, discountPercent: Math.min(100, num) };
        return { ...item, [field]: num };
      })
    );
  };

  const handleSubmitCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplierId) {
      alert("Silakan pilih Supplier penerbit.");
      return;
    }
    if (poItems.length === 0) {
      alert("Tambahkan minimal 1 item buku pada PO.");
      return;
    }
    if (poItems.some((it) => it.quantityOrdered <= 0)) {
      alert("Jumlah pesanan buku harus lebih dari 0.");
      return;
    }
    if (poItems.some((it) => it.discountPercent < 0 || it.discountPercent > 100)) {
      alert("Diskon per item harus antara 0 sampai 100 persen.");
      return;
    }

    setIsSubmittingPO(true);
    try {
      await postJson(
        "/api/procurement/purchase-orders",
        {
          supplierId: poSupplierId,
          orderDate: poOrderDate,
          expectedArrivalDate: poExpectedArrival || undefined,
          notes: poNotes.trim() || undefined,
          items: poItems,
        },
        "Gagal menerbitkan Purchase Order."
      );
      await onCreated();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingPO(false);
    }
  };

  const header = calcPoHeader(poItems);
  const poTotals = {
    gross: header.subtotalGross,
    discount: header.discountTotal,
    net: header.totalAmount,
    totalQty: poItems.reduce((s, it) => s + (it.quantityOrdered || 0), 0),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E7F3FF] text-[#1877F2] flex items-center justify-center font-bold">
              +
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#050505]">Terbitkan Purchase Order (PO) Baru</h3>
              <p className="text-[11px] text-[#65676B]">Pemesanan buku satuan resmi dari vendor/penerbit</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#65676B] hover:text-[#050505] p-1 rounded-lg hover:bg-[#F0F2F5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmitCreatePO} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Supplier / Vendor Resmi *
              </label>
              <div className="flex gap-2">
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  required
                  className="flex-1 px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
                >
                  {suppliers.length === 0 ? (
                    <option value="">Belum ada supplier (Tambah baru)</option>
                  ) : (
                    suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(true)}
                  className="px-2.5 py-2 border border-[#CED0D4] rounded-xl hover:bg-[#F0F2F5] text-xs font-semibold shrink-0"
                  title="Tambah Supplier Baru"
                >
                  + Baru
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#050505] mb-1">
                Tujuan Barang Masuk
              </span>
              <div className="w-full px-3 py-2 bg-[#F0F2F5] border border-[#E4E6EB] rounded-xl text-xs font-semibold text-[#050505]">
                Gudang Logistik
              </div>
              <p className="text-[10px] text-[#65676B] mt-1">
                PO selalu dipusatkan di Gudang Logistik, lalu diteruskan ke cabang lewat transfer.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Tanggal Order *
              </label>
              <input
                type="date"
                value={poOrderDate}
                onChange={(e) => setPoOrderDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Estimasi Tiba di Gudang
              </label>
              <input
                type="date"
                value={poExpectedArrival}
                onChange={(e) => setPoExpectedArrival(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#E4E6EB]">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-[#050505]">
                Daftar Item Buku Dipesan ({poItems.length} Judul)
              </label>
              <button
                type="button"
                onClick={handleAddPOItemRow}
                className="text-[#1877F2] hover:text-[#166FE5] text-xs font-semibold flex items-center gap-1 active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Judul Buku</span>
              </button>
            </div>

            {catalogBooks.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                Katalog buku masih kosong. Tambahkan buku di tab <strong>Katalog</strong> terlebih dahulu.
              </div>
            ) : poItems.length === 0 ? (
              <div className="p-4 bg-[#F0F2F5] border border-dashed border-[#CED0D4] rounded-xl text-center text-[#65676B]">
                Belum ada item buku. Klik <strong>Tambah Judul Buku</strong> untuk menambahkan.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {poItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#F9FAFB] border border-[#E4E6EB] rounded-xl grid grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="col-span-12 sm:col-span-5">
                      <label className="block text-[10px] text-[#65676B] mb-0.5">Judul Buku</label>
                      <select
                        value={item.bookId}
                        onChange={(e) => handleUpdatePOItem(idx, "bookId", e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505] font-medium"
                      >
                        {catalogBooks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title} ({b.isbn})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-5 sm:col-span-2">
                      <label className="block text-[10px] text-[#65676B] mb-0.5">Qty Pesan</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="0"
                        value={item.quantityOrdered === 0 ? "" : item.quantityOrdered}
                        onChange={(e) => handleUpdatePOItem(idx, "quantityOrdered", e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs text-center font-bold text-[#1877F2]"
                      />
                    </div>

                    <div className="col-span-5 sm:col-span-2">
                      <label className="block text-[10px] text-[#65676B] mb-0.5">
                        Harga Satuan (Rp) <span className="text-[9px] text-[#8A8D91]">(Katalog)</span>
                      </label>
                      <input
                        type="number"
                        readOnly
                        tabIndex={-1}
                        placeholder="0"
                        value={item.unitPrice === 0 ? "" : item.unitPrice}
                        className="w-full px-2.5 py-1.5 bg-[#F0F2F5] border border-[#E4E6EB] rounded-lg text-xs font-semibold text-right text-[#65676B] cursor-not-allowed select-none"
                        title="Harga satuan terkunci mengikuti harga beli di katalog"
                      />
                    </div>

                    <div className="col-span-5 sm:col-span-2">
                      <label className="block text-[10px] text-[#65676B] mb-0.5">Diskon (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        placeholder="0"
                        value={item.discountPercent === 0 ? "" : item.discountPercent}
                        onChange={(e) => handleUpdatePOItem(idx, "discountPercent", e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs font-semibold text-right"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleRemovePOItemRow(idx)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E4E6EB]">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Catatan PO (Opsional)
              </label>
              <textarea
                rows={2}
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                placeholder="Contoh: Pengadaan buku Cambridge Semester 1..."
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>

            <PoTotalsSummary
              gross={poTotals.gross}
              discount={poTotals.discount}
              net={poTotals.net}
              totalQty={poTotals.totalQty}
            />
          </div>

          <div className="pt-3 border-t border-[#E4E6EB] flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] rounded-xl font-semibold text-[#65676B] transition-colors active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmittingPO}
              className="px-5 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-[0.98] disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmittingPO ? "Menerbitkan..." : "Terbitkan PO"}</span>
            </button>
          </div>
        </form>
      </div>

      {isSupplierModalOpen && (
        <CreateSupplierModal
          onClose={() => setIsSupplierModalOpen(false)}
          onCreated={async (newId) => {
            const fresh = await reloadSuppliers();
            if (fresh.some((s) => s.id === newId)) setPoSupplierId(newId);
            setIsSupplierModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
