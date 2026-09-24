import { useState, useEffect, useCallback } from "react";
import { School } from "../types";
import { 
  Search, 
  RefreshCw, 
  X, 
  PackageCheck
} from "lucide-react";

interface PurchaseOrderItem {
  id: string;
  bookId: string;
  title: string;
  isbn: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  targetSchoolId: string;
  schoolName: string;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  orderDate: string;
  expectedArrivalDate?: string;
  totalAmount: number;
  notes?: string;
  items: PurchaseOrderItem[];
}

interface ProcurementViewProps {
  activeSchool: School | null;
}

export function ProcurementView({ activeSchool }: ProcurementViewProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [activeReceivingPO, setActiveReceivingPO] = useState<PurchaseOrder | null>(null);

  // Inbound receiving inputs: poItemId -> quantity
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const poRes = await fetch("/api/procurement/purchase-orders");
      const poData = await poRes.json();
      if (poData.success) setPurchaseOrders(poData.data);
    } catch (err) {
      console.error("Failed to load procurement data", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenReceive = (po: PurchaseOrder) => {
    setActiveReceivingPO(po);
    const initial: Record<string, number> = {};
    po.items.forEach((item) => {
      const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
      initial[item.id] = remaining;
    });
    setReceiveQuantities(initial);
  };

  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReceivingPO) return;
    setIsSubmitting(true);
    try {
      const receivedItems = Object.entries(receiveQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([poItemId, quantityToReceive]) => ({
          poItemId,
          quantityToReceive,
        }));

      if (receivedItems.length === 0) {
        alert("Pilih minimal 1 item untuk diterima.");
        setIsSubmitting(false);
        return;
      }

      const res = await fetch(`/api/procurement/purchase-orders/${activeReceivingPO.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivedItems }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Gagal mencatat penerimaan");

      setActiveReceivingPO(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPOs = purchaseOrders.filter((po) => {
    const q = searchQuery.toLowerCase();
    return (
      po.poNumber.toLowerCase().includes(q) ||
      po.supplierName.toLowerCase().includes(q) ||
      po.items.some((i) => i.title.toLowerCase().includes(q))
    );
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
            Kelola penerbit/supplier resmi, terbitkan Purchase Order (PO) buku satuan, dan catat penerimaan fisik barang masuk (*inbound receiving*) ke stok satuan.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center justify-between gap-3">
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
      </div>

      {/* PO List */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F8FA] border-b border-[#E4E6EB] text-[#65676B] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">No. PO & Tanggal</th>
                <th className="py-3 px-4">Supplier & Tujuan</th>
                <th className="py-3 px-4">Item Buku Dipesan</th>
                <th className="py-3 px-4">Status PO</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EB]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#65676B]">
                    Memuat data Purchase Order...
                  </td>
                </tr>
              ) : filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#65676B]">
                    Belum ada dokumen Purchase Order pengadaan.
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => {
                  const isFullyReceived = po.status === "received";

                  return (
                    <tr key={po.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-sm text-[#1877F2]">{po.poNumber}</div>
                        <div className="text-[11px] text-[#65676B] mt-0.5">
                          Tgl: {po.orderDate}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#050505]">{po.supplierName}</div>
                        <div className="text-[11px] text-[#65676B]">Tujuan: {po.schoolName}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {po.items.map((it) => (
                            <div key={it.id} className="text-[11px]">
                              <span className="font-semibold text-[#050505]">{it.title}</span>:{" "}
                              <span className="text-[#1877F2] font-semibold">{it.quantityReceived}</span>
                              <span className="text-[#65676B]">/{it.quantityOrdered} eks</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {po.status === "ordered" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            ORDERED (DIPESAN)
                          </span>
                        )}
                        {po.status === "partially_received" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            SEBAGIAN MASUK
                          </span>
                        )}
                        {po.status === "received" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            SELESAI (LENGKAP)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {!isFullyReceived && (
                          <button
                            onClick={() => handleOpenReceive(po)}
                            className="px-3 py-1.5 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-xl text-xs transition-colors shadow-2xs inline-flex items-center gap-1.5"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Terima Barang</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECEIVE INBOUND MODAL */}
      {activeReceivingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#050505]">Penerimaan Barang Fisik (Inbound Receiving)</h3>
              <button onClick={() => setActiveReceivingPO(null)} className="text-[#65676B] hover:text-[#050505]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitReceive} className="p-6 space-y-4 text-xs">
              <div className="bg-[#F0F2F5] p-3 rounded-xl flex justify-between">
                <span>No. PO: <strong className="font-mono">{activeReceivingPO.poNumber}</strong></span>
                <span>Supplier: <strong>{activeReceivingPO.supplierName}</strong></span>
              </div>

              <div>
                <label className="block font-semibold mb-2">Input Jumlah Buku yang Diterima Hari Ini:</label>
                <div className="space-y-2.5 max-h-56 overflow-y-auto">
                  {activeReceivingPO.items.map((it) => {
                    const remaining = Math.max(0, it.quantityOrdered - it.quantityReceived);

                    return (
                      <div key={it.id} className="p-3 bg-white border border-[#CED0D4] rounded-xl flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-[#050505] truncate">{it.title}</div>
                          <div className="text-[10px] text-[#65676B]">
                            Telah diterima: {it.quantityReceived} dari total {it.quantityOrdered}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            value={receiveQuantities[it.id] ?? 0}
                            onChange={(e) =>
                              setReceiveQuantities({
                                ...receiveQuantities,
                                [it.id]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-20 px-2.5 py-1.5 border border-[#CED0D4] rounded-lg text-center font-bold text-[#1877F2]"
                          />
                          <span className="text-[11px] text-[#65676B]">/ max {remaining}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveReceivingPO(null)}
                  className="px-4 py-2 bg-[#F0F2F5] rounded-xl font-semibold text-[#65676B]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#1877F2] text-white rounded-xl font-semibold flex items-center gap-1.5"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Menyimpan..." : "Konfirmasi Masuk Stok Satuan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
