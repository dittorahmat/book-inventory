import { useCallback, useState } from "react";
import { School } from "../types";
import { PoSendAction } from "../components/procurement/PoSendAction";
import { PoWorkflowActions } from "../components/procurement/PoWorkflowActions";
import { PoPrintView, type PrintablePo } from "../components/procurement/PoPrintView";
import { SupplierMasterSection, type SupplierRecord } from "../components/procurement/SupplierMasterSection";
import { CreatePOModal } from "../components/procurement/CreatePOModal";
import { CreateSupplierModal } from "../components/procurement/CreateSupplierModal";
import { ReceivingModal } from "../components/procurement/ReceivingModal";
import { PODetailModal } from "../components/procurement/PODetailModal";
import { toPrintablePo, type PurchaseOrder } from "../components/procurement/procurement-types";
import { useProcurementData } from "../components/procurement/useProcurementData";
import {
  Search,
  RefreshCw,
  Plus,
  Truck,
  Building2,
  Calendar,
  PackageCheck,
  CheckCircle2,
  FileText
} from "lucide-react";

interface ProcurementViewProps {
  activeSchool: School | null;
}

export function ProcurementView({ activeSchool }: ProcurementViewProps) {
  const {
    purchaseOrders,
    suppliers,
    catalogBooks,
    isLoading,
    defaultSupplierId,
    loadData,
    loadSuppliers,
    loadPurchaseOrders,
  } = useProcurementData();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal orchestration (data holder; isi + logika tinggal di sub-modul)
  const [isCreatePOModalOpen, setIsCreatePOModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [activeReceivingPO, setActiveReceivingPO] = useState<PurchaseOrder | null>(null);
  const [detailPo, setDetailPo] = useState<PurchaseOrder | null>(null);
  const [printPo, setPrintPo] = useState<PrintablePo | null>(null);

  // Refresh daftar + sinkronkan modal detail & pratinjau cetak dari data
  // segar (hindari stale closure: purchaseOrders state bisa basi saat
  // aksi workflow selesai).
  const refreshAfterWorkflow = useCallback(async () => {
    try {
      const fresh = await loadPurchaseOrders();
      if (fresh) {
        setDetailPo((prev) => (prev ? fresh.find((p: PurchaseOrder) => p.id === prev.id) ?? null : null));
        setPrintPo((prev) => {
          if (!prev) return prev;
          const found = fresh.find((p: PurchaseOrder) => p.id === prev.id);
          return found ? toPrintablePo(found) : prev;
        });
        return;
      }
    } catch {
      // Abaikan, pengguna bisa muat ulang manual.
    }
    await loadData();
  }, [loadData, loadPurchaseOrders]);

  // Filter Purchase Orders
  const filteredPOs = purchaseOrders.filter((po) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      po.poNumber.toLowerCase().includes(q) ||
      po.supplierName.toLowerCase().includes(q) ||
      po.items.some((i) => i.title.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === "all" || po.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5">
      {/* Editorial Header */}
      <div className="bg-white rounded-2xl p-5 border border-[#E4E6EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-md">
              Inbound Procurement
            </span>
            <span className="text-xs text-[#65676B]">&bull; {activeSchool?.name || "Pusat & Cabang"}</span>
          </div>
          <h1 className="text-xl font-bold text-[#050505] tracking-tight mt-1">
            Pengadaan Buku Supplier (PO) & Stok Masuk
          </h1>
          <p className="text-xs text-[#65676B] max-w-2xl mt-0.5">
            Kelola penerbit resmi, terbitkan Purchase Order (PO) pengadaan buku, dan catat penerimaan fisik barang masuk (*inbound receiving*) langsung menjadi stok satuan siap pakai.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => loadData()}
            title="Muat ulang data"
            className="p-2.5 rounded-xl border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors active:scale-[0.98]"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-[#CED0D4] bg-white hover:bg-[#F0F2F5] text-[#050505] font-semibold text-xs transition-colors flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Building2 className="w-3.5 h-3.5 text-[#65676B]" />
            <span>+ Supplier</span>
          </button>

          <button
            onClick={() => setIsCreatePOModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold text-xs transition-colors shadow-2xs flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Buat PO Baru</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
          <input
            type="text"
            placeholder="Cari nomor PO, nama supplier, buku..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] placeholder-[#65676B] focus:outline-hidden focus:border-[#1877F2]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-semibold text-[#65676B] mr-1 hidden sm:inline">Status:</span>
          {(["all", "draft", "printed", "signed_uploaded", "ordered", "sent", "partially_received", "received"] as const).map((st) => {
            const labels: Record<string, string> = {
              all: "Semua Status",
              draft: "Draft",
              printed: "Dicetak",
              signed_uploaded: "TTD Diupload",
              ordered: "Dipesan",
              sent: "Terkirim",
              partially_received: "Sebagian",
              received: "Selesai",
            };
            const active = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? "bg-[#1877F2] text-white"
                    : "bg-white border border-[#CED0D4] text-[#65676B] hover:bg-[#F0F2F5]"
                }`}
              >
                {labels[st]}
              </button>
            );
          })}
        </div>
      </div>

      <SupplierMasterSection
        suppliers={suppliers as SupplierRecord[]}
        onChanged={loadData}
      />

      {/* PO List Table */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F8FA] border-b border-[#E4E6EB] text-[#65676B] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">No. PO & Tanggal</th>
                <th className="py-3 px-4">Supplier & Tujuan</th>
                <th className="py-3 px-4">Item Buku Dipesan</th>
                <th className="py-3 px-4">Status & Progress</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EB]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#65676B]">
                    Memuat data Purchase Order...
                  </td>
                </tr>
              ) : filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="max-w-xs mx-auto text-[#65676B] space-y-2">
                      <FileText className="w-8 h-8 mx-auto text-[#CED0D4]" />
                      <div className="font-semibold text-xs text-[#050505]">Belum ada Purchase Order</div>
                      <p className="text-[11px]">
                        Klik tombol <strong>+ Buat PO Baru</strong> di atas untuk memesan buku lepasan ke supplier resmi.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => {
                  const isFullyReceived = po.status === "received";
                  const totalOrdered = po.items.reduce((s, it) => s + it.quantityOrdered, 0);
                  const totalReceived = po.items.reduce((s, it) => s + it.quantityReceived, 0);
                  const percent = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

                  return (
                    <tr key={po.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-xs text-[#1877F2]">
                          <button
                            type="button"
                            onClick={() => setDetailPo(po)}
                            className="hover:underline inline-flex items-center gap-1"
                            title="Buka detail PO"
                          >
                            {po.poNumber}
                            <FileText className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[11px] text-[#65676B] mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#65676B]" />
                          <span>{po.orderDate}</span>
                        </div>
                        {po.expectedArrivalDate && (
                          <div className="text-[10px] text-amber-700 mt-0.5">
                            Est. Tiba: {po.expectedArrivalDate}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#050505]">{po.supplierName}</div>
                        <div className="text-[11px] text-[#65676B] flex items-center gap-1 mt-0.5">
                          <Truck className="w-3 h-3 text-[#65676B]" />
                          <span>Tujuan: {po.schoolName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {po.items.map((it) => (
                            <div key={it.id} className="text-[11px]">
                              <span className="font-semibold text-[#050505]">{it.title}</span>:{" "}
                              <span className="text-[#1877F2] font-semibold">{it.quantityReceived}</span>
                              <span className="text-[#65676B]">/{it.quantityOrdered} eks</span>
                              {it.discountPercent > 0 && (
                                <span className="ml-1 px-1.5 py-px text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  −{it.discountPercent}%
                                </span>
                              )}
                            </div>
                          ))}
                          <div className="text-[11px] pt-0.5 border-t border-[#E4E6EB]">
                            <span className="text-[#65676B]">Netto: </span>
                            <span className="font-bold text-[#050505]">
                              Rp {(po.subtotalGross !== undefined && po.discountTotal !== undefined
                                ? po.subtotalGross - po.discountTotal
                                : po.totalAmount
                              ).toLocaleString("id-ID")}
                            </span>
                            {po.discountTotal !== undefined && po.discountTotal > 0 && (
                              <span className="text-[#65676B]">
                                {" "}(kotor Rp {po.subtotalGross?.toLocaleString("id-ID")})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          {po.status === "draft" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#F0F2F5] text-[#65676B] border border-[#CED0D4] inline-block">
                              DRAFT (BELUM DICETAK)
                            </span>
                          )}
                          {po.status === "printed" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-block">
                              DICETAK — MENUNGGU BUKTI TTD
                            </span>
                          )}
                          {po.status === "signed_uploaded" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#E7F3FF] text-[#1877F2] border border-[#B2D8FF] inline-block">
                              TTD SUDAH DIUPLOAD
                            </span>
                          )}
                          {po.status === "ordered" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 inline-block">
                              ORDERED (DIPESAN)
                            </span>
                          )}
                          {po.status === "sent" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                              TERKIRIM KE SUPPLIER
                            </span>
                          )}
                          {po.status === "partially_received" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-block">
                              SEBAGIAN MASUK
                            </span>
                          )}
                          {po.status === "received" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                              SELESAI (LENGKAP)
                            </span>
                          )}

                          {/* Progress bar */}
                          <div className="w-32 bg-[#F0F2F5] rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${isFullyReceived ? "bg-emerald-500" : "bg-[#1877F2]"}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-[#65676B]">
                            {totalReceived} dari {totalOrdered} eks ({percent}%)
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <PoWorkflowActions
                            po={po}
                            onChanged={loadData}
                            onPrint={() => setPrintPo(toPrintablePo(po))}
                          />
                          <PoSendAction po={po} onSent={loadData} />
                          {!isFullyReceived ? (
                            <button
                              onClick={() => setActiveReceivingPO(po)}
                              className="px-3 py-1.5 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-xl text-xs transition-colors shadow-2xs inline-flex items-center gap-1.5 active:scale-[0.98]"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Terima Inbound</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Masuk Stok
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreatePOModalOpen && (
        <CreatePOModal
          suppliers={suppliers}
          catalogBooks={catalogBooks}
          defaultSupplierId={defaultSupplierId}
          onClose={() => setIsCreatePOModalOpen(false)}
          onCreated={loadData}
          reloadSuppliers={loadSuppliers}
        />
      )}

      {isSupplierModalOpen && (
        <CreateSupplierModal
          onClose={() => setIsSupplierModalOpen(false)}
          onCreated={async () => {
            await loadSuppliers();
            setIsSupplierModalOpen(false);
          }}
        />
      )}

      {activeReceivingPO && (
        <ReceivingModal
          po={activeReceivingPO}
          onClose={() => setActiveReceivingPO(null)}
          onReceived={loadData}
        />
      )}

      {detailPo && (
        <PODetailModal
          po={detailPo}
          onClose={() => setDetailPo(null)}
          onChanged={refreshAfterWorkflow}
          onPrint={() => setPrintPo(toPrintablePo(detailPo))}
        />
      )}

      {printPo && <PoPrintView po={printPo} onClose={() => setPrintPo(null)} onChanged={refreshAfterWorkflow} />}
    </div>
  );
}
