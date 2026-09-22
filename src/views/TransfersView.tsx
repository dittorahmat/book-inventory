import { useState, useEffect } from "react";
import { School, BookItem, TransferShipment } from "../types";
import { Send, CheckCircle, Plus, ArrowRight } from "lucide-react";

export function TransfersView({ activeSchool }: { activeSchool: School | null }) {
  const [shipments, setShipments] = useState<TransferShipment[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [availableItems, setAvailableItems] = useState<BookItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [destinationSchoolId, setDestinationSchoolId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<TransferShipment | null>(null);

  const fetchShipments = () => {
    fetch("/api/shipments")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setShipments(data.data);
      });
  };

  useEffect(() => {
    fetchShipments();
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAllSchools(data.data);
      });
  }, []);

  const loadAvailableItemsForTransfer = () => {
    if (!activeSchool) return;
    fetch(`/api/book-items?schoolId=${activeSchool.id}&status=in_stock`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAvailableItems(data.data);
      });
  };

  const handleCreateShipment = async () => {
    if (!activeSchool || !destinationSchoolId || selectedItems.length === 0) return;
    const res = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromSchoolId: activeSchool.id,
        toSchoolId: destinationSchoolId,
        bookItemIds: selectedItems,
        reason: transferReason.trim() || undefined,
        notes: "Scheduled distribution",
      }),
    });
    const data = await res.json();
    if (data.success) {
      setIsCreating(false);
      setSelectedItems([]);
      setTransferReason("");
      fetchShipments();
    } else {
      alert(data.message || "Failed to create shipment");
    }
  };

  const handleDispatch = async (id: string) => {
    try {
      const res = await fetch(`/api/shipments/${id}/dispatch`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Pengiriman transfer berhasil di-dispatch!");
        fetchShipments();
        if (selectedShipment?.id === id) openShipmentDetail(id);
      } else {
        alert(data.message || "Gagal melakukan dispatch pengiriman");
      }
    } catch {
      alert("Terjadi kesalahan jaringan saat dispatch pengiriman");
    }
  };

  const handleReceive = async (shipment: TransferShipment) => {
    if (!shipment.items || shipment.items.length === 0) {
      alert("Tidak ada item manifest buku pada transfer ini");
      return;
    }
    const receipts = shipment.items.map((item) => ({
      bookItemId: item.bookItemId,
      condition: "good" as const,
    }));

    try {
      const res = await fetch(`/api/shipments/${shipment.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemReceipts: receipts }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Penerimaan transfer berhasil dikonfirmasi! Stok buku telah dialokasikan ke cabang ini.");
        fetchShipments();
        openShipmentDetail(shipment.id);
      } else {
        alert(data.message || (data.error && typeof data.error === "string" ? data.error : "Gagal mengonfirmasi penerimaan transfer"));
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan sistem saat konfirmasi: ${err?.message || "Koneksi terputus"}`);
    }
  };

  const openShipmentDetail = async (id: string) => {
    const res = await fetch(`/api/shipments/${id}`);
    const data = await res.json();
    if (data.success) {
      setSelectedShipment(data.data);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-[#E4E6EB] shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-[#050505]">
            Inter-School Stock Transfers
          </h2>
          <p className="text-xs text-[#65676B] mt-0.5">
            Logistik pengiriman dan mutasi buku antar kampus Al Wildan & HQ Pusat.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreating(true);
            loadAvailableItemsForTransfer();
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Buat Surat Jalan Transfer
        </button>
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="p-5 sm:p-6 border border-[#CED0D4] bg-white rounded-2xl space-y-4 max-w-xl shadow-xl">
          <div className="font-bold text-base text-[#050505] border-b border-[#E4E6EB] pb-3">
            Draf Pengiriman Transfer Baru
          </div>
          <div className="text-xs text-[#65676B]">
            Sekolah Asal: <span className="font-bold text-[#1877F2]">{activeSchool?.name}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Cabang / Sekolah Tujuan</label>
            <select
              value={destinationSchoolId}
              onChange={(e) => setDestinationSchoolId(e.target.value)}
              className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs bg-white font-medium focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
            >
              <option value="">Pilih Cabang Tujuan</option>
              {allSchools
                .filter((s) => s.id !== activeSchool?.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Alasan / Kategori Mutasi (Opsional)</label>
            <input
              type="text"
              placeholder="Contoh: Retur buku rusak, Pemenuhan kuota kurikulum..."
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">
              Pilih Eksemplar Buku ({availableItems.length} tersedia di stok)
            </label>
            <div className="border border-[#E4E6EB] rounded-xl max-h-48 overflow-y-auto divide-y divide-[#E4E6EB] p-2 text-xs bg-[#F0F2F5]">
              {availableItems.length === 0 ? (
                <div className="text-[#65676B] py-3 text-center">Tidak ada buku siap kirim di cabang ini.</div>
              ) : (
                availableItems.map((item) => (
                  <label key={item.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedItems([...selectedItems, item.id]);
                          else setSelectedItems(selectedItems.filter((id) => id !== item.id));
                        }}
                        className="rounded border-[#CED0D4] text-[#1877F2] focus:ring-[#1877F2] w-4 h-4"
                      />
                      <span className="font-mono text-xs font-bold text-[#1877F2]">{item.barcode}</span>
                      <span className="text-[#050505] font-medium">({item.book?.title})</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.condition === "damaged"
                          ? "bg-red-100 text-[#FA383E]"
                          : item.condition === "new"
                          ? "bg-emerald-100 text-[#31A24C]"
                          : "bg-white text-[#65676B] border border-[#CED0D4]"
                      }`}
                    >
                      {item.condition}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-[#E4E6EB]">
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleCreateShipment}
              disabled={!destinationSchoolId || selectedItems.length === 0}
              className="px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm disabled:opacity-50"
            >
              Simpan Draf
            </button>
          </div>
        </div>
      )}

      {/* Shipments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shipments.map((s) => (
          <div
            key={s.id}
            onClick={() => openShipmentDetail(s.id)}
            className="border border-[#E4E6EB] bg-white p-4 sm:p-5 rounded-xl hover:border-[#CED0D4] hover:shadow-md cursor-pointer transition-all space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[#1877F2]">{s.shipmentNumber}</span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                  s.status === "completed"
                    ? "bg-emerald-50 text-[#31A24C] border border-emerald-200"
                    : s.status === "in_transit"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-[#F0F2F5] text-[#65676B] border border-[#CED0D4]"
                }`}
              >
                {s.status.replace("_", " ")}
              </span>
            </div>

            <div className="text-xs text-[#050505] font-semibold flex items-center gap-2">
              <span>{allSchools.find((sch) => sch.id === s.fromSchoolId)?.name || s.fromSchoolId}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#1877F2] shrink-0" />
              <span>{allSchools.find((sch) => sch.id === s.toSchoolId)?.name || s.toSchoolId}</span>
            </div>

            {s.reason && (
              <div className="text-xs text-[#050505] bg-[#F0F2F5] px-3 py-1.5 rounded-lg border border-[#E4E6EB]">
                <span className="text-[#65676B] font-semibold">Alasan:</span> {s.reason}
              </div>
            )}

            <div className="pt-2.5 flex justify-between items-center text-xs text-[#65676B] border-t border-[#E4E6EB]">
              <span>Dibuat {new Date(s.createdAt).toLocaleDateString()}</span>
              <span className="text-[#1877F2] font-semibold hover:underline">Lihat Rincian</span>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#CED0D4] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E6EB] pb-3">
              <div>
                <div className="font-bold text-lg text-[#050505]">{selectedShipment.shipmentNumber}</div>
                <div className="text-xs text-[#65676B] font-semibold mt-0.5">
                  {selectedShipment.fromSchool?.name} &rarr; {selectedShipment.toSchool?.name}
                </div>
                {selectedShipment.reason && (
                  <div className="text-xs text-[#050505] mt-1 bg-[#F0F2F5] px-2.5 py-1 rounded-md">
                    <span className="text-[#65676B] font-semibold">Alasan:</span> {selectedShipment.reason}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E7F3FF] text-[#1877F2] uppercase">
                {selectedShipment.status}
              </span>
            </div>

            <div>
              <div className="text-xs font-bold text-[#65676B] mb-1.5">Manifest Items ({selectedShipment.items?.length || 0})</div>
              <div className="divide-y divide-[#E4E6EB] border border-[#E4E6EB] rounded-xl max-h-48 overflow-y-auto text-xs bg-[#F0F2F5]">
                {selectedShipment.items?.map((item) => (
                  <div key={item.id} className="p-2.5 flex justify-between items-center bg-white first:rounded-t-xl last:rounded-b-xl">
                    <div>
                      <div className="font-mono font-bold text-xs text-[#1877F2] flex items-center gap-1.5">
                        <span>{item.barcode}</span>
                        {item.condition && (
                          <span
                            className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase ${
                              item.condition === "damaged"
                                ? "bg-red-50 text-[#FA383E] border border-red-200"
                                : item.condition === "new"
                                ? "bg-emerald-50 text-[#31A24C] border border-emerald-200"
                                : "bg-[#F0F2F5] text-[#65676B] border border-[#CED0D4]"
                            }`}
                          >
                            {item.condition}
                          </span>
                        )}
                      </div>
                      <div className="text-[#050505] font-medium text-xs">{item.bookTitle}</div>
                    </div>
                    {item.receivedCondition && (
                      <span className="text-[10px] font-bold text-[#65676B] bg-[#F0F2F5] px-2 py-0.5 rounded-full border border-[#CED0D4]">
                        Diterima: {item.receivedCondition}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-3 border-t border-[#E4E6EB]">
              <button
                onClick={() => setSelectedShipment(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] transition-colors"
              >
                Tutup
              </button>

              {selectedShipment.status === "draft" && (
                <button
                  onClick={() => handleDispatch(selectedShipment.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  Dispatch Pengiriman
                </button>
              )}

              {selectedShipment.status === "in_transit" && (
                <button
                  onClick={() => handleReceive(selectedShipment)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#31A24C] hover:bg-[#2B8F42] text-white rounded-lg transition-colors shadow-sm"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Konfirmasi Penerimaan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
