import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Book } from "../../types";
import { calcPoHeader } from "../../lib/book-pricing";
import { getJson, postJson } from "../../lib/api";
import { PoTotalsSummary } from "./PoTotalsSummary";
import { CreateSupplierModal } from "./CreateSupplierModal";
import type { NewPOItemInput, Supplier } from "./procurement-types";
import {
  type BookDemandItemInfo,
  buildSupplierPoItems,
  buyPriceOfBook,
  calcDemandQty,
  filterSupplierEligibleBooks,
  makePoItemRow,
} from "./po-demand-helpers";
import { PoItemRow } from "./PoItemRow";
import { PoHeaderFields } from "./PoHeaderFields";

interface CreatePOModalProps {
  suppliers: Supplier[];
  catalogBooks: Book[];
  defaultSupplierId: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
  reloadSuppliers: () => Promise<Supplier[]>;
}

// ==========================================
// CREATE PO MODAL
// ==========================================

/** Modal penerbitan PO: supplier, tanggal, item buku, ringkasan tiga angka. */
export function CreatePOModal({ suppliers, catalogBooks, defaultSupplierId, onClose, onCreated, reloadSuppliers }: CreatePOModalProps) {
  const [poSupplierId, setPoSupplierId] = useState(defaultSupplierId);
  const [poOrderDate, setPoOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [poExpectedArrival, setPoExpectedArrival] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [bufferPercent, setBufferPercent] = useState<number>(10);
  const [demandMap, setDemandMap] = useState<Record<string, BookDemandItemInfo>>({});
  const [editedBookIds, setEditedBookIds] = useState<Set<string>>(() => new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmittingPO, setIsSubmittingPO] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // Buku valid per supplier: strictly hanya buku yang memuat supplier terpilih.
  const eligibleBooks = useMemo(
    () => filterSupplierEligibleBooks(catalogBooks, poSupplierId),
    [catalogBooks, poSupplierId]
  );

  const [poItems, setPoItems] = useState<NewPOItemInput[]>([]);

  // Muat ringkasan demand siswa per buku dari server dan populate baris PO awal
  useEffect(() => {
    let active = true;
    getJson<{ success: boolean; data: { bufferPercentage: number; items: Record<string, BookDemandItemInfo> } }>(
      "/api/procurement/book-demand-summary"
    )
      .then((res) => {
        if (!active || !res?.data) return;
        const items = res.data.items || {};
        const buffer = typeof res.data.bufferPercentage === "number" ? res.data.bufferPercentage : 10;
        setDemandMap(items);
        setBufferPercent(buffer);
        // Sinkronkan baris awal PO dari eligibleBooks dan demand yang baru saja dimuat
        setPoItems(buildSupplierPoItems(eligibleBooks, catalogBooks, items, buffer));
      })
      .catch((err: unknown) => {
        if (active) {
          const message = err instanceof Error ? err.message : "Gagal memuat rekomendasi kebutuhan siswa.";
          setLoadError(message);
        }
      });
    return () => {
      active = false;
    };
  }, [eligibleBooks, catalogBooks]);

  function buyPriceOf(bookId: string, fallback = 0): number {
    return buyPriceOfBook(catalogBooks, bookId, fallback);
  }

  const handleSupplierChange = (next: string) => {
    setPoSupplierId(next);
    setEditedBookIds(new Set());
    const targetBooks = filterSupplierEligibleBooks(catalogBooks, next);
    const newItems = buildSupplierPoItems(targetBooks, catalogBooks, demandMap, bufferPercent);
    setPoItems(newItems);
  };

  const handleBufferPercentChange = (val: number) => {
    const nextBuffer = Math.max(0, val || 0);
    setBufferPercent(nextBuffer);
    setPoItems((prev) =>
      prev.map((item) => {
        // Baris yang telah diedit manual oleh user dipertahankan, tidak ditimpa
        if (editedBookIds.has(item.bookId)) return item;
        const d = demandMap[item.bookId];
        const studentCount = d?.studentCount ?? 0;
        const autoQty = calcDemandQty(studentCount, nextBuffer);
        return { ...item, quantityOrdered: autoQty };
      })
    );
  };

  const handleAddPOItemRow = () => {
    if (eligibleBooks.length === 0) {
      alert("Tidak ada judul buku yang tersedia dari supplier ini.");
      return;
    }
    const defaultBook = eligibleBooks[0];
    const d = demandMap[defaultBook.id];
    const initialQty = calcDemandQty(d?.studentCount ?? 0, bufferPercent);
    setPoItems((prev) => [...prev, makePoItemRow(defaultBook.id, buyPriceOf(defaultBook.id), initialQty > 0 ? initialQty : 10)]);
  };

  const handleRemovePOItemRow = (index: number) => {
    setPoItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdatePOItem = (index: number, field: keyof NewPOItemInput, val: string | number) => {
    setPoItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (field === "bookId") {
          const bId = String(val);
          return { ...item, bookId: bId, unitPrice: buyPriceOf(bId, 0) };
        }
        if (field === "quantityOrdered") {
          setEditedBookIds((old) => new Set(old).add(item.bookId));
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
    // Saring otomatis hanya item dengan qty > 0 (buku supplier dengan 0 siswa yang tidak dipesan diabaikan)
    const validItems = poItems.filter((it) => it.quantityOrdered > 0);
    if (validItems.length === 0) {
      alert("Tambahkan minimal 1 item buku dengan jumlah pesanan lebih dari 0.");
      return;
    }
    if (validItems.some((it) => it.discountPercent < 0 || it.discountPercent > 100)) {
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
          items: validItems,
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
          <PoHeaderFields
            suppliers={suppliers}
            supplierId={poSupplierId}
            onSupplierChange={handleSupplierChange}
            onOpenSupplierModal={() => setIsSupplierModalOpen(true)}
            orderDate={poOrderDate}
            onOrderDateChange={setPoOrderDate}
            expectedArrival={poExpectedArrival}
            onExpectedArrivalChange={setPoExpectedArrival}
            loadError={loadError}
          />

          <div className="pt-2 border-t border-[#E4E6EB]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-3">
                <label className="block text-xs font-bold text-[#050505]">
                  Daftar Item Buku Dipesan ({poItems.length} Judul)
                </label>
                <div className="flex items-center gap-1.5 bg-[#F0F2F5] px-2.5 py-1 rounded-lg border border-[#E4E6EB]">
                  <span className="text-[11px] font-semibold text-[#65676B]">Buffer (%):</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bufferPercent}
                    onChange={(e) => handleBufferPercentChange(Number(e.target.value))}
                    className="w-12 px-1.5 py-0.5 bg-white border border-[#CED0D4] rounded text-xs text-center font-bold text-[#1877F2]"
                    title="Persentase cadangan pesanan di atas jumlah siswa"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddPOItemRow}
                className="text-[#1877F2] hover:text-[#166FE5] text-xs font-semibold flex items-center gap-1 active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Judul Buku</span>
              </button>
            </div>

            {eligibleBooks.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                {catalogBooks.length === 0
                  ? <>Katalog buku masih kosong. Tambahkan buku di tab <strong>Katalog</strong> terlebih dahulu.</>
                  : "Tidak ada judul buku yang tersedia dari supplier ini. Ubah supplier atau tambah relasi di katalog."}
              </div>
            ) : poItems.length === 0 ? (
              <div className="p-4 bg-[#F0F2F5] border border-dashed border-[#CED0D4] rounded-xl text-center text-[#65676B]">
                Belum ada item buku. Klik <strong>Tambah Judul Buku</strong> untuk menambahkan.
              </div>
            ) : (
              <div className="space-y-2 pr-1">
                {poItems.map((item, idx) => (
                  <PoItemRow
                    key={idx}
                    idx={idx}
                    item={item}
                    eligibleBooks={eligibleBooks}
                    demand={demandMap[item.bookId]}
                    onUpdate={handleUpdatePOItem}
                    onRemove={handleRemovePOItemRow}
                  />
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
