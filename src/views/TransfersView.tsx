import { useState } from "react";
import { School } from "../types";
import { Plus, ArrowRight, Send, CheckCircle, Trash2, Zap } from "lucide-react";
import { LoosePicker } from "../components/transfers/LoosePicker";
import { PackagePicker } from "../components/transfers/PackagePicker";
import { TransferTotalBar } from "../components/transfers/TransferTotalBar";
import { ShipmentDetailModal } from "../components/transfers/ShipmentDetailModal";
import { useTransfers } from "../components/transfers/useTransfers";
import { formatRupiah } from "../lib/transfer-pricing";
import { getJson } from "../lib/api";

export function TransfersView({ activeSchool }: { activeSchool: School | null }) {
  const {
    shipments,
    allSchools,
    schoolsError,
    fetchSchools,
    availableItems,
    selectedItems,
    bundles,
    selectedPackages,
    destinationSchoolId,
    setDestinationSchoolId,
    transferReason,
    setTransferReason,
    isCreating,
    setIsCreating,
    isInstant,
    setIsInstant,
    selectedShipment,
    setSelectedShipment,
    looseTotal,
    packageTotal,
    toggleLooseItem,
    togglePackageItem,
    loadAvailableItemsForTransfer,
    handleCreateShipment,
    handleDispatch,
    handleReceive,
    handleDeleteShipment,
    openShipmentDetail,
  } = useTransfers(activeSchool);
  const [transferTab, setTransferTab] = useState<"loose" | "package">("loose");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "in_transit" | "completed">("all");

  const filteredShipments = shipments.filter((s) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "draft") return s.status === "draft";
    if (statusFilter === "in_transit") return s.status === "in_transit";
    if (statusFilter === "completed") return s.status === "completed" || s.status === "completed_with_discrepancy";
    return true;
  });

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
            {schoolsError && (
              <div className="flex items-center justify-between gap-2 mt-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
                <p className="text-xs text-red-700">{schoolsError}</p>
                <button
                  type="button"
                  onClick={fetchSchools}
                  className="shrink-0 text-xs font-bold text-red-700 underline underline-offset-2 active:scale-[0.98]"
                >
                  Coba lagi
                </button>
              </div>
            )}
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
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setTransferTab("loose")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors active:scale-[0.98] ${
                  transferTab === "loose" ? "bg-[#1877F2] text-white" : "bg-[#F0F2F5] text-[#65676B]"
                }`}
              >
                Satuan ({availableItems.length})
              </button>
              <button
                type="button"
                onClick={() => setTransferTab("package")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors active:scale-[0.98] ${
                  transferTab === "package" ? "bg-[#1877F2] text-white" : "bg-[#F0F2F5] text-[#65676B]"
                }`}
              >
                Paketan ({selectedPackages.length})
              </button>
            </div>
            <div className="border border-[#E4E6EB] rounded-xl max-h-48 overflow-y-auto divide-y divide-[#E4E6EB] p-2 text-xs bg-[#F0F2F5]">
              {transferTab === "loose" ? (
                <LoosePicker items={availableItems} selectedIds={selectedItems} onToggle={toggleLooseItem} />
              ) : (
                <PackagePicker
                  bundles={bundles}
                  selectedIds={selectedPackages}
                  onToggle={togglePackageItem}
                />
              )}
            </div>
          </div>

          <TransferTotalBar looseTotal={looseTotal} packageTotal={packageTotal} />

          <div className="flex items-center justify-between pt-3 border-t border-[#E4E6EB]">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isInstant}
                onChange={(e) => setIsInstant(e.target.checked)}
                className="w-4 h-4 text-[#1877F2] rounded border-[#CED0D4] focus:ring-0"
              />
              <span className="text-xs font-semibold text-[#050505] flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                Transfer Langsung (Instan / Tanpa Transit)
              </span>
            </label>

            <div className="flex gap-2.5">
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleCreateShipment}
                disabled={!destinationSchoolId || (selectedItems.length === 0 && selectedPackages.length === 0)}
                className="px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm disabled:opacity-50"
              >
                {isInstant ? "Transfer Sekarang (Instan)" : "Simpan Draf"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
            statusFilter === "all" ? "bg-[#1877F2] text-white shadow-xs" : "bg-white text-[#65676B] border border-[#E4E6EB] hover:bg-[#F0F2F5]"
          }`}
        >
          Semua ({shipments.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("draft")}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
            statusFilter === "draft" ? "bg-[#1877F2] text-white shadow-xs" : "bg-white text-[#65676B] border border-[#E4E6EB] hover:bg-[#F0F2F5]"
          }`}
        >
          Draf ({shipments.filter((s) => s.status === "draft").length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("in_transit")}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
            statusFilter === "in_transit" ? "bg-amber-600 text-white shadow-xs" : "bg-white text-[#65676B] border border-[#E4E6EB] hover:bg-[#F0F2F5]"
          }`}
        >
          Dalam Perjalanan ({shipments.filter((s) => s.status === "in_transit").length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("completed")}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
            statusFilter === "completed" ? "bg-emerald-600 text-white shadow-xs" : "bg-white text-[#65676B] border border-[#E4E6EB] hover:bg-[#F0F2F5]"
          }`}
        >
          Selesai Diterima ({shipments.filter((s) => s.status === "completed" || s.status === "completed_with_discrepancy").length})
        </button>
      </div>

      {/* Shipments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredShipments.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-2xl border border-[#E4E6EB] text-center text-xs text-[#65676B]">
            Tidak ada pengiriman transfer dengan status ini.
          </div>
        ) : (
          filteredShipments.map((s) => (
            <div
              key={s.id}
              className="border border-[#E4E6EB] bg-white p-4 sm:p-5 rounded-xl hover:border-[#CED0D4] hover:shadow-md transition-all space-y-3 shadow-xs"
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

              <div className="flex items-center justify-between text-xs bg-[#E7F3FF] px-3 py-1.5 rounded-lg border border-[#1877F2]/20">
                <span className="text-[#65676B] font-semibold">
                  Nilai: {(s.looseCount || 0) > 0 || (s.packageCount || 0) > 0
                    ? `${s.looseCount || 0} satuan${(s.packageCount || 0) > 0 ? ` + ${s.packageCount} paket` : ""}`
                    : "Menunggu rincian"}
                </span>
                <span className="font-bold text-[#1877F2]">{formatRupiah(s.totalDeclaredValue || 0)}</span>
              </div>

              <div className="pt-2.5 flex justify-between items-center text-xs text-[#65676B] border-t border-[#E4E6EB]">
                <button
                  type="button"
                  onClick={() => openShipmentDetail(s.id)}
                  className="text-[#1877F2] font-semibold hover:underline"
                >
                  Rincian Item
                </button>

                <div className="flex items-center gap-1.5">
                  {s.status === "draft" && (
                    <button
                      type="button"
                      onClick={() => handleDispatch(s.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg transition-colors shadow-2xs active:scale-[0.98]"
                      title="Dispatch pengiriman"
                    >
                      <Send className="w-3 h-3" />
                      <span>Kirim</span>
                    </button>
                  )}

                  {s.status === "in_transit" && (
                    <button
                      type="button"
                      onClick={async () => {
                        const detail = await getJson<any>(`/api/shipments/${s.id}`, "Gagal memuat detail transfer");
                        handleReceive(detail);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-[#31A24C] hover:bg-[#2B8F42] text-white rounded-lg transition-colors shadow-2xs active:scale-[0.98]"
                      title="Terima transfer"
                    >
                      <CheckCircle className="w-3 h-3" />
                      <span>Terima</span>
                    </button>
                  )}

                  {s.status !== "completed" && s.status !== "completed_with_discrepancy" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Hapus pengiriman ${s.shipmentNumber}?`)) {
                          handleDeleteShipment(s.id);
                        }
                      }}
                      className="p-1 text-[#65676B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors active:scale-[0.98]"
                      title="Hapus pengiriman transfer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedShipment && (
        <ShipmentDetailModal
          shipment={selectedShipment}
          onClose={() => setSelectedShipment(null)}
          onDispatch={handleDispatch}
          onReceive={handleReceive}
        />
      )}
    </div>
  );
}
