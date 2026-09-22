import { useState, useEffect } from "react";
import { School, BookItem } from "../types";
import { Search, Tag, ArrowRight, CheckSquare, Square, X } from "lucide-react";

export function InventoryView({ activeSchool }: { activeSchool: School | null }) {
  const [items, setItems] = useState<BookItem[]>([]);
  const [searchBarcode, setSearchBarcode] = useState("");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  
  // Quick Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [destinationSchoolId, setDestinationSchoolId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  const fetchItems = () => {
    if (!activeSchool) return;
    fetch(`/api/book-items?schoolId=${activeSchool.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setItems(data.data);
          // Clean up selected items that no longer exist
          setSelectedItemIds((prev) => prev.filter((id) => data.data.some((item: BookItem) => item.id === id)));
        }
      });
  };

  useEffect(() => {
    fetchItems();
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAllSchools(data.data);
          // Default destination: HQ if current is branch, or first other branch
          const defaultDest = data.data.find(
            (s: School) => s.id !== activeSchool?.id && (activeSchool?.type === "branch" ? s.type === "main" : true)
          );
          if (defaultDest) setDestinationSchoolId(defaultDest.id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSchool]);

  const handleUpdateCondition = async (id: string, condition: "new" | "good" | "fair" | "damaged") => {
    await fetch(`/api/book-items/${id}/condition`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ condition }),
    });
    fetchItems();
  };

  const filteredItems = items.filter((item) => {
    const matchBarcode =
      item.barcode.toLowerCase().includes(searchBarcode.toLowerCase()) ||
      (item.book?.title && item.book.title.toLowerCase().includes(searchBarcode.toLowerCase()));
    const matchCondition = conditionFilter === "all" || item.condition === conditionFilter;
    return matchBarcode && matchCondition;
  });

  const availableInStockItems = filteredItems.filter((item) => item.status === "in_stock");
  const isAllSelected =
    availableInStockItems.length > 0 &&
    availableInStockItems.every((item) => selectedItemIds.includes(item.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Unselect all currently visible in-stock items
      const visibleIds = new Set(availableInStockItems.map((i) => i.id));
      setSelectedItemIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      // Select all visible in-stock items
      const newSelected = new Set([...selectedItemIds, ...availableInStockItems.map((i) => i.id)]);
      setSelectedItemIds(Array.from(newSelected));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedItemsData = items.filter((item) => selectedItemIds.includes(item.id));

  const handleOpenTransferModal = () => {
    if (selectedItemIds.length === 0) return;
    // Set smart default reason if all selected items are damaged
    const allDamaged = selectedItemsData.every((i) => i.condition === "damaged");
    if (allDamaged && !transferReason) {
      setTransferReason("Retur buku rusak");
    }
    setIsTransferModalOpen(true);
  };

  const handleCreateQuickTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchool || !destinationSchoolId || selectedItemIds.length === 0) return;

    setIsSubmittingTransfer(true);
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSchoolId: activeSchool.id,
          toSchoolId: destinationSchoolId,
          bookItemIds: selectedItemIds,
          reason: transferReason.trim() || undefined,
          notes: transferNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Draf transfer berhasil dibuat dengan nomor ${data.data.shipmentNumber}!`);
        setIsTransferModalOpen(false);
        setSelectedItemIds([]);
        setTransferReason("");
        setTransferNotes("");
        fetchItems();
      } else {
        alert(data.message || "Gagal membuat transfer");
      }
    } catch {
      alert("Terjadi kesalahan sistem saat membuat transfer");
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E5E0] pb-4">
        <div>
          <h2 className="text-xl font-editorial font-semibold text-[#1A1A1A]">
            Branch Stock Inventory
          </h2>
          <p className="text-xs text-[#737373]">
            Physical copies stationed at {activeSchool ? activeSchool.name : "..."} ({items.length} units total).
          </p>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#737373]" />
            <input
              type="text"
              placeholder="Scan or search barcode / title..."
              value={searchBarcode}
              onChange={(e) => setSearchBarcode(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-mono border border-[#E5E5E0] rounded bg-white w-64 focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>

          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="text-xs font-mono border border-[#E5E5E0] py-1.5 px-2 rounded bg-white text-[#555555]"
          >
            <option value="all">All Conditions</option>
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>
      </div>

      {/* Floating / Top Multi-Select Action Bar */}
      {selectedItemIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-[#1A1A1A] text-white rounded shadow-sm">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="bg-white/20 px-2 py-0.5 rounded text-white font-semibold">
              {selectedItemIds.length}
            </span>
            <span>buku dipilih untuk mutasi/retur</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedItemIds([])}
              className="px-2.5 py-1 text-xs border border-white/30 rounded text-white/80 hover:text-white hover:border-white transition-colors"
            >
              Batal Pilih
            </button>
            <button
              onClick={handleOpenTransferModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono bg-white text-[#1A1A1A] rounded hover:bg-neutral-200 transition-colors font-medium"
            >
              <span>Transfer / Retur Buku</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Item List */}
      <div className="border border-[#E5E5E0] bg-white rounded overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E0] bg-[#FAFAF8] text-[#737373] font-mono text-[11px]">
              <th className="py-2.5 px-3 w-8 text-center">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  disabled={availableInStockItems.length === 0}
                  className="text-[#737373] hover:text-[#1A1A1A] disabled:opacity-30 inline-flex items-center"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[#1A1A1A]" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>
              </th>
              <th className="py-2.5 px-4 font-normal">Barcode Tag</th>
              <th className="py-2.5 px-4 font-normal">Book Title</th>
              <th className="py-2.5 px-4 font-normal">ISBN</th>
              <th className="py-2.5 px-4 font-normal">Condition</th>
              <th className="py-2.5 px-4 font-normal">Status</th>
              <th className="py-2.5 px-4 font-normal text-right">Audit Condition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0EC]">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#737373]">
                  No physical copies found at this branch.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedItemIds.includes(item.id);
                const canSelect = item.status === "in_stock";

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isSelected ? "bg-neutral-50 font-medium" : "hover:bg-[#FAFAF8]"
                    }`}
                  >
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!canSelect}
                        onChange={() => handleToggleSelectItem(item.id)}
                        className="rounded border-[#E5E5E0] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-[#1A1A1A] flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-[#737373]" />
                      {item.barcode}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#1A1A1A]">{item.book?.title || "Untitled"}</td>
                    <td className="py-3 px-4 font-mono text-[#737373]">{item.book?.isbn}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono capitalize ${
                          item.condition === "new"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : item.condition === "damaged"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-gray-100 text-gray-700 border border-gray-200"
                        }`}
                      >
                        {item.condition}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono capitalize ${
                          item.status === "in_stock"
                            ? "bg-slate-100 text-slate-700"
                            : item.status === "in_transit"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <select
                        value={item.condition}
                        disabled={item.status !== "in_stock"}
                        onChange={(e) => handleUpdateCondition(item.id, e.target.value as any)}
                        className="text-[11px] font-mono border border-[#E5E5E0] rounded px-1.5 py-0.5 bg-white text-[#555555] disabled:opacity-50"
                      >
                        <option value="new">New</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="damaged">Damaged</option>
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E5E5E0] rounded p-5 max-w-lg w-full space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E5E5E0] pb-3">
              <div>
                <div className="font-editorial font-semibold text-base text-[#1A1A1A]">
                  Buat Pengiriman Transfer / Retur
                </div>
                <div className="text-xs text-[#737373]">
                  Kirim {selectedItemIds.length} eksemplar buku dari{" "}
                  <span className="font-semibold text-[#1A1A1A]">{activeSchool?.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-[#737373] hover:text-[#1A1A1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickTransfer} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-[#737373] mb-1">
                  Sekolah / Cabang Tujuan
                </label>
                <select
                  required
                  value={destinationSchoolId}
                  onChange={(e) => setDestinationSchoolId(e.target.value)}
                  className="w-full border border-[#E5E5E0] p-2 rounded text-xs bg-white font-medium"
                >
                  <option value="">Pilih tujuan transfer...</option>
                  {allSchools
                    .filter((s) => s.id !== activeSchool?.id)
                    .map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name} ({school.type === "main" ? "Kantor Pusat / HQ" : "Cabang"})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#737373] mb-1">
                  Alasan / Keterangan Transfer (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Retur buku rusak, Pemindahan stok, dsb."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full border border-[#E5E5E0] p-2 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#737373] mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan untuk ekspedisi atau staf penerima..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full border border-[#E5E5E0] p-2 rounded text-xs resize-none"
                />
              </div>

              {/* Selected Items Summary List */}
              <div className="border border-[#E5E5E0] rounded p-2.5 bg-[#FAFAF8] max-h-36 overflow-y-auto space-y-1.5">
                <div className="text-[11px] font-mono text-[#737373] mb-1">
                  Daftar Buku Terpilih ({selectedItemsData.length} items):
                </div>
                {selectedItemsData.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs py-1 border-b border-[#F0F0EC] last:border-none"
                  >
                    <div className="truncate pr-2">
                      <span className="font-mono text-[11px] text-[#555555] mr-1.5">
                        {item.barcode}
                      </span>
                      <span className="text-[#1A1A1A]">{item.book?.title}</span>
                    </div>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                        item.condition === "damaged"
                          ? "bg-red-100 text-red-700"
                          : item.condition === "new"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {item.condition}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-[#E5E5E0]">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-3 py-1.5 text-xs border border-[#E5E5E0] rounded text-[#737373] hover:bg-neutral-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="px-3 py-1.5 text-xs bg-[#1A1A1A] text-white rounded font-mono hover:bg-[#333333] disabled:opacity-50"
                >
                  {isSubmittingTransfer ? "Membuat Draf..." : "Buat Draf Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
