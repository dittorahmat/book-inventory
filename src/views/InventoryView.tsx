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
        const errorMsg = data.message || (data.error && typeof data.error === "string" ? data.error : JSON.stringify(data.error)) || "Gagal membuat transfer";
        alert(errorMsg);
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan sistem saat membuat transfer: ${err?.message || "Koneksi terputus"}`);
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-[#E4E6EB] shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-[#050505]">
            Branch Stock Inventory
          </h2>
          <p className="text-xs text-[#65676B] mt-0.5">
            Physical copies stationed at <span className="font-semibold text-[#050505]">{activeSchool ? activeSchool.name : "..."}</span> ({items.length} units total).
          </p>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#65676B]" />
            <input
              type="text"
              placeholder="Cari barcode atau judul buku..."
              value={searchBarcode}
              onChange={(e) => setSearchBarcode(e.target.value)}
              className="pl-9 pr-3 py-2 text-xs font-medium border border-[#CED0D4] rounded-full bg-[#F0F2F5] hover:bg-[#E4E6EB] focus:bg-white w-full sm:w-64 focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] transition-all placeholder-[#8A8D91]"
            />
          </div>

          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="text-xs font-semibold border border-[#CED0D4] py-2 px-3 rounded-full bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#050505] w-full sm:w-auto focus:outline-none focus:border-[#1877F2] cursor-pointer"
          >
            <option value="all">Semua Kondisi</option>
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectedItemIds.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-8 md:max-w-md z-20 flex items-center justify-between p-3.5 bg-white text-[#050505] rounded-2xl shadow-xl border border-[#CED0D4]">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="bg-[#E7F3FF] text-[#1877F2] px-2.5 py-0.5 rounded-full font-bold">
              {selectedItemIds.length}
            </span>
            <span className="truncate max-w-[130px] sm:max-w-none text-[#050505]">buku dipilih</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedItemIds([])}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleOpenTransferModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm"
            >
              <span>Transfer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Select all bar for Mobile */}
      <div className="md:hidden flex items-center justify-between bg-white border border-[#E4E6EB] rounded-xl p-3 text-xs font-semibold shadow-xs">
        <button
          type="button"
          onClick={handleToggleSelectAll}
          disabled={availableInStockItems.length === 0}
          className="flex items-center gap-2 text-[#050505] disabled:opacity-40"
        >
          {isAllSelected ? (
            <CheckSquare className="w-4 h-4 text-[#1877F2]" />
          ) : (
            <Square className="w-4 h-4 text-[#65676B]" />
          )}
          <span>Pilih Semua Tersedia ({availableInStockItems.length})</span>
        </button>
        <span className="text-[11px] text-[#65676B]">
          Total: {filteredItems.length}
        </span>
      </div>

      {/* Mobile Card List View (< md) */}
      <div className="md:hidden space-y-3">
        {filteredItems.length === 0 ? (
          <div className="border border-[#E4E6EB] bg-white rounded-xl p-8 text-center text-xs text-[#65676B] shadow-xs">
            Tidak ada fisik buku ditemukan di cabang ini.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSelected = selectedItemIds.includes(item.id);
            const canSelect = item.status === "in_stock";

            return (
              <div
                key={item.id}
                onClick={() => canSelect && handleToggleSelectItem(item.id)}
                className={`border rounded-xl p-4 bg-white transition-all shadow-xs ${
                  isSelected
                    ? "border-[#1877F2] ring-2 ring-[#1877F2]/20 bg-[#E7F3FF]/30"
                    : "border-[#E4E6EB] hover:border-[#CED0D4]"
                } ${canSelect ? "cursor-pointer" : "opacity-80"}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="p-1 -ml-1 text-[#050505]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canSelect) handleToggleSelectItem(item.id);
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-[#1877F2]" />
                      ) : (
                        <Square className={`w-5 h-5 ${canSelect ? "text-[#65676B]" : "text-neutral-300"}`} />
                      )}
                    </div>
                    <div className="font-mono text-xs font-bold text-[#050505] flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#1877F2]" />
                      {item.barcode}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        item.condition === "new"
                          ? "bg-emerald-50 text-[#31A24C] border border-emerald-200"
                          : item.condition === "damaged"
                          ? "bg-red-50 text-[#FA383E] border border-red-200"
                          : "bg-[#F0F2F5] text-[#65676B] border border-[#CED0D4]"
                      }`}
                    >
                      {item.condition}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        item.status === "in_stock"
                          ? "bg-[#E7F3FF] text-[#1877F2]"
                          : item.status === "in_transit"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-red-50 text-[#FA383E] border border-red-200"
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <div className="font-semibold text-sm text-[#050505] leading-snug mb-1">
                  {item.book?.title || "Untitled Book"}
                </div>
                <div className="text-xs text-[#65676B] mb-3">
                  ISBN: {item.book?.isbn || "-"}
                </div>

                <div
                  className="flex items-center justify-between pt-2.5 border-t border-[#E4E6EB] text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs font-medium text-[#65676B]">Audit Kondisi:</span>
                  <select
                    value={item.condition}
                    disabled={item.status !== "in_stock"}
                    onChange={(e) => handleUpdateCondition(item.id, e.target.value as any)}
                    className="text-xs font-semibold border border-[#CED0D4] rounded-lg px-2.5 py-1 bg-[#F0F2F5] text-[#050505] disabled:opacity-50 min-h-[34px]"
                  >
                    <option value="new">New</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Item List Table (>= md) */}
      <div className="hidden md:block border border-[#E4E6EB] bg-white rounded-xl shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E4E6EB] bg-[#F0F2F5] text-[#65676B] text-[11px] font-bold uppercase tracking-wider">
              <th className="py-3 px-3 w-10 text-center">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  disabled={availableInStockItems.length === 0}
                  className="text-[#65676B] hover:text-[#1877F2] disabled:opacity-30 inline-flex items-center"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-[#1877F2]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="py-3 px-4">Barcode Tag</th>
              <th className="py-3 px-4">Judul Buku</th>
              <th className="py-3 px-4">ISBN</th>
              <th className="py-3 px-4">Kondisi</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Audit Kondisi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[#65676B]">
                  Tidak ada fisik buku ditemukan di cabang ini.
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
                      isSelected ? "bg-[#E7F3FF]/40 font-semibold" : "hover:bg-[#F0F2F5]/60"
                    }`}
                  >
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!canSelect}
                        onChange={() => handleToggleSelectItem(item.id)}
                        className="rounded border-[#CED0D4] text-[#1877F2] focus:ring-[#1877F2] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed w-4 h-4"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#050505] flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#1877F2]" />
                      {item.barcode}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#050505]">{item.book?.title || "Untitled"}</td>
                    <td className="py-3 px-4 text-[#65676B] font-mono text-[11px]">{item.book?.isbn}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          item.condition === "new"
                            ? "bg-emerald-50 text-[#31A24C] border border-emerald-200"
                            : item.condition === "damaged"
                            ? "bg-red-50 text-[#FA383E] border border-red-200"
                            : "bg-[#F0F2F5] text-[#65676B] border border-[#CED0D4]"
                        }`}
                      >
                        {item.condition}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          item.status === "in_stock"
                            ? "bg-[#E7F3FF] text-[#1877F2]"
                            : item.status === "in_transit"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-red-50 text-[#FA383E] border border-red-200"
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
                        className="text-xs font-semibold border border-[#CED0D4] rounded-lg px-2.5 py-1 bg-[#F0F2F5] text-[#050505] disabled:opacity-50 hover:bg-[#E4E6EB] cursor-pointer"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#CED0D4] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E6EB] pb-3.5">
              <div>
                <div className="font-bold text-lg text-[#050505]">
                  Buat Pengiriman Transfer / Retur
                </div>
                <div className="text-xs text-[#65676B] mt-0.5">
                  Kirim {selectedItemIds.length} eksemplar buku dari{" "}
                  <span className="font-bold text-[#1877F2]">{activeSchool?.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#65676B] hover:text-[#050505] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickTransfer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">
                  Sekolah / Cabang Tujuan
                </label>
                <select
                  required
                  value={destinationSchoolId}
                  onChange={(e) => setDestinationSchoolId(e.target.value)}
                  className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs bg-white font-medium focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
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
                <label className="block text-xs font-semibold text-[#050505] mb-1">
                  Alasan / Keterangan Transfer (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Retur buku rusak, Pemindahan stok, dsb."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan untuk ekspedisi atau staf penerima..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs resize-none focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                />
              </div>

              {/* Selected Items Summary List */}
              <div className="border border-[#E4E6EB] rounded-xl p-3 bg-[#F0F2F5] max-h-36 overflow-y-auto space-y-1.5">
                <div className="text-xs font-bold text-[#65676B] mb-1">
                  Daftar Buku Terpilih ({selectedItemsData.length} items):
                </div>
                {selectedItemsData.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs py-1 border-b border-[#E4E6EB] last:border-none"
                  >
                    <div className="truncate pr-2">
                      <span className="font-mono text-xs font-bold text-[#1877F2] mr-2">
                        {item.barcode}
                      </span>
                      <span className="text-[#050505] font-medium">{item.book?.title}</span>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.condition === "damaged"
                          ? "bg-red-100 text-[#FA383E]"
                          : item.condition === "new"
                          ? "bg-emerald-100 text-[#31A24C]"
                          : "bg-white text-[#65676B] border border-[#CED0D4]"
                      }`}
                    >
                      {item.condition}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-[#E4E6EB]">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm disabled:opacity-50"
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
