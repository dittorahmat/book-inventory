import { useCallback, useState } from "react";
import { School } from "../types";
import type { StaffRole } from "../components/layout/AppTabsNavigation";
import { PoPrintView, type PrintablePo } from "../components/procurement/PoPrintView";
import { SupplierMasterSection, type SupplierRecord } from "../components/procurement/SupplierMasterSection";
import { CreatePOModal } from "../components/procurement/CreatePOModal";
import { CreateSupplierModal } from "../components/procurement/CreateSupplierModal";
import { ReceivingModal } from "../components/procurement/ReceivingModal";
import { PODetailModal } from "../components/procurement/PODetailModal";
import { PurchaseOrdersTable } from "../components/procurement/PurchaseOrdersTable";
import { toPrintablePo, type PurchaseOrder } from "../components/procurement/procurement-types";
import { useProcurementData } from "../components/procurement/useProcurementData";
import {
  Search,
  RefreshCw,
  Plus,
  Building2
} from "lucide-react";

interface ProcurementViewProps {
  activeSchool: School | null;
  userRole?: StaffRole;
}

const isSchoolRole = (role?: StaffRole): boolean =>
  role === "school_admin" || role === "branch_admin";

export function ProcurementView({ activeSchool, userRole }: ProcurementViewProps) {
  const {
    purchaseOrders,
    suppliers,
    catalogBooks,
    isLoading,
    loadError,
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
  const filteredPOs = purchaseOrders.filter((po) => {    const q = searchQuery.toLowerCase();
    const matchesSearch =
      po.poNumber.toLowerCase().includes(q) ||
      po.supplierName.toLowerCase().includes(q) ||
      po.items.some((i) => i.title.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === "all" || po.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Mode cetak terisolasi: saat pratinjau dibuka, DOM hanya berisi dokumen PO
  // sehingga window.print() mencetak dokumen saja, bukan seluruh aplikasi.
  // Defense-in-depth: peran sekolah tidak pernah melihat UI supplier
  // (tab sudah disembunyikan + API menolak 403).
  if (isSchoolRole(userRole)) {
    return (
      <div className="rounded-2xl border border-[#E4E6EB] bg-white p-8 text-center">
        <p className="text-sm font-bold text-[#050505]">Layar khusus gudang</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-[#65676B]">
          Pengadaan ke supplier hanya dikelola admin pusat dan admin gudang. Untuk kebutuhan buku cabang, buka tab
          “Pesan ke Gudang”.
        </p>
      </div>
    );
  }
  if (printPo) {
    return <PoPrintView po={printPo} onClose={() => setPrintPo(null)} onChanged={refreshAfterWorkflow} />;
  }

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

      {loadError && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => loadData()}
            className="px-3 py-1.5 rounded-lg bg-white border border-red-200 font-semibold hover:bg-red-100/50 active:scale-[0.98] shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* PO List Table */}
      <PurchaseOrdersTable
        purchaseOrders={filteredPOs}
        isLoading={isLoading}
        onSelectDetail={(po) => setDetailPo(po)}
        onPrint={(printable) => setPrintPo(printable)}
        onReceive={(po) => setActiveReceivingPO(po)}
        onChanged={refreshAfterWorkflow}
      />

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
    </div>
  );
}
