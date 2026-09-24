import { useState, useEffect, useCallback } from "react";
import { School, Book } from "../types";
import { 
  Search, 
  RefreshCw, 
  X, 
  PackageCheck,
  Plus,
  Truck,
  Building2,
  Calendar,
  AlertCircle,
  Trash2,
  CheckCircle2,
  FileText
} from "lucide-react";

interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
}

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

interface NewPOItemInput {
  bookId: string;
  quantityOrdered: number;
  unitPrice: number;
}

export function ProcurementView({ activeSchool }: ProcurementViewProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Inbound Receiving Modal State
  const [activeReceivingPO, setActiveReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
  const [isSubmittingReceive, setIsSubmittingReceive] = useState(false);

  // Create PO Modal State
  const [isCreatePOModalOpen, setIsCreatePOModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poTargetSchoolId, setPoTargetSchoolId] = useState("");
  const [poOrderDate, setPoOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [poExpectedArrival, setPoExpectedArrival] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poItems, setPoItems] = useState<NewPOItemInput[]>([]);
  const [isSubmittingPO, setIsSubmittingPO] = useState(false);

  // Create Supplier Modal State
  const [isCreateSupplierModalOpen, setIsCreateSupplierModalOpen] = useState(false);
  const [newSupplierCode, setNewSupplierCode] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierContact, setNewSupplierContact] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [newSupplierAddress, setNewSupplierAddress] = useState("");
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [poRes, supRes, schoolRes, booksRes] = await Promise.all([
        fetch("/api/procurement/purchase-orders"),
        fetch("/api/procurement/suppliers"),
        fetch("/api/schools"),
        fetch("/api/books"),
      ]);

      const [poData, supData, schoolData, booksData] = await Promise.all([
        poRes.json(),
        supRes.json(),
        schoolRes.json(),
        booksRes.json(),
      ]);

      if (poData.success) setPurchaseOrders(poData.data);
      if (supData.success) {
        setSuppliers(supData.data);
        if (supData.data.length > 0 && !poSupplierId) {
          setPoSupplierId(supData.data[0].id);
        }
      }
      if (schoolData.success) {
        setSchools(schoolData.data);
      }
      if (booksData.success) {
        setCatalogBooks(booksData.data);
      }
    } catch (err) {
      console.error("Failed to load procurement data", err);
    } finally {
      setIsLoading(false);
    }
  }, [poSupplierId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set default target school whenever activeSchool or schools change
  useEffect(() => {
    if (activeSchool) {
      setPoTargetSchoolId(activeSchool.id);
    } else if (schools.length > 0 && !poTargetSchoolId) {
      setPoTargetSchoolId(schools[0].id);
    }
  }, [activeSchool, schools, poTargetSchoolId]);

  // Handler: Open Create PO Modal with 1 default item row
  const handleOpenCreatePO = () => {
    if (catalogBooks.length > 0) {
      setPoItems([
        {
          bookId: catalogBooks[0].id,
          quantityOrdered: 20,
          unitPrice: 75000,
        },
      ]);
    } else {
      setPoItems([]);
    }
    setPoOrderDate(new Date().toISOString().split("T")[0]);
    setPoExpectedArrival("");
    setPoNotes("");
    setIsCreatePOModalOpen(true);
  };

  const handleAddPOItemRow = () => {
    if (catalogBooks.length === 0) return;
    setPoItems((prev) => [
      ...prev,
      {
        bookId: catalogBooks[0].id,
        quantityOrdered: 10,
        unitPrice: 50000,
      },
    ]);
  };

  const handleRemovePOItemRow = (index: number) => {
    setPoItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdatePOItem = (index: number, field: keyof NewPOItemInput, val: any) => {
    setPoItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          [field]: field === "bookId" ? val : Math.max(0, Number(val) || 0),
        };
      })
    );
  };

  // Submit New Purchase Order
  const handleSubmitCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplierId) {
      alert("Silakan pilih Supplier penerbit.");
      return;
    }
    if (!poTargetSchoolId) {
      alert("Silakan tentukan cabang sekolah tujuan.");
      return;
    }
    if (poItems.length === 0) {
      alert("Tambahkan minimal 1 item buku pada PO.");
      return;
    }

    const invalidItem = poItems.find((it) => it.quantityOrdered <= 0);
    if (invalidItem) {
      alert("Jumlah pesanan buku harus lebih dari 0.");
      return;
    }

    setIsSubmittingPO(true);
    try {
      const res = await fetch("/api/procurement/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: poSupplierId,
          targetSchoolId: poTargetSchoolId,
          orderDate: poOrderDate,
          expectedArrivalDate: poExpectedArrival || undefined,
          notes: poNotes.trim() || undefined,
          items: poItems,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menerbitkan Purchase Order.");
      }

      setIsCreatePOModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingPO(false);
    }
  };

  // Submit New Supplier
  const handleSubmitCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierCode.trim() || !newSupplierName.trim()) {
      alert("Kode dan Nama Supplier wajib diisi.");
      return;
    }

    setIsSubmittingSupplier(true);
    try {
      const res = await fetch("/api/procurement/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newSupplierCode.trim().toUpperCase(),
          name: newSupplierName.trim(),
          contactPerson: newSupplierContact.trim() || undefined,
          phone: newSupplierPhone.trim() || undefined,
          email: newSupplierEmail.trim() || undefined,
          address: newSupplierAddress.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mendaftarkan supplier.");
      }

      setIsCreateSupplierModalOpen(false);
      setNewSupplierCode("");
      setNewSupplierName("");
      setNewSupplierContact("");
      setNewSupplierPhone("");
      setNewSupplierEmail("");
      setNewSupplierAddress("");

      // Refresh and auto select newly created supplier
      const supRes = await fetch("/api/procurement/suppliers");
      const supData = await supRes.json();
      if (supData.success) {
        setSuppliers(supData.data);
        setPoSupplierId(data.data.id);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  // Inbound Receiving Handlers
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
    setIsSubmittingReceive(true);
    try {
      const receivedItems = Object.entries(receiveQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([poItemId, quantityToReceive]) => ({
          poItemId,
          quantityToReceive,
        }));

      if (receivedItems.length === 0) {
        alert("Pilih minimal 1 item untuk diterima.");
        setIsSubmittingReceive(false);
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
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingReceive(false);
    }
  };

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

  const totalCalculatedPO = poItems.reduce(
    (sum, item) => sum + (item.quantityOrdered || 0) * (item.unitPrice || 0),
    0
  );

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
            onClick={() => setIsCreateSupplierModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-[#CED0D4] bg-white hover:bg-[#F0F2F5] text-[#050505] font-semibold text-xs transition-colors flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Building2 className="w-3.5 h-3.5 text-[#65676B]" />
            <span>+ Supplier</span>
          </button>

          <button
            onClick={handleOpenCreatePO}
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
          {(["all", "ordered", "partially_received", "received"] as const).map((st) => {
            const labels: Record<string, string> = {
              all: "Semua Status",
              ordered: "Dipesan",
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
                        <div className="font-mono font-bold text-xs text-[#1877F2]">{po.poNumber}</div>
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
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          {po.status === "ordered" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 inline-block">
                              ORDERED (DIPESAN)
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
                        {!isFullyReceived ? (
                          <button
                            onClick={() => handleOpenReceive(po)}
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CREATE NEW PURCHASE ORDER */}
      {isCreatePOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
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
                onClick={() => setIsCreatePOModalOpen(false)}
                className="text-[#65676B] hover:text-[#050505] p-1 rounded-lg hover:bg-[#F0F2F5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
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
                      onClick={() => setIsCreateSupplierModalOpen(true)}
                      className="px-2.5 py-2 border border-[#CED0D4] rounded-xl hover:bg-[#F0F2F5] text-xs font-semibold shrink-0"
                      title="Tambah Supplier Baru"
                    >
                      + Baru
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1">
                    Gudang Cabang Tujuan *
                  </label>
                  <select
                    value={poTargetSchoolId}
                    onChange={(e) => setPoTargetSchoolId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
                  >
                    {schools.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        {sch.name} {sch.type === "main" ? "(Pusat/HQ)" : ""}
                      </option>
                    ))}
                  </select>
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

              {/* Items Section */}
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
                        <div className="col-span-12 sm:col-span-6">
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
                            value={item.quantityOrdered}
                            onChange={(e) => handleUpdatePOItem(idx, "quantityOrdered", e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs text-center font-bold text-[#1877F2]"
                          />
                        </div>

                        <div className="col-span-5 sm:col-span-3">
                          <label className="block text-[10px] text-[#65676B] mb-0.5">Harga Satuan (Rp)</label>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={item.unitPrice}
                            onChange={(e) => handleUpdatePOItem(idx, "unitPrice", e.target.value)}
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

              {/* Notes & Summary */}
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

                <div className="bg-[#F0F2F5] p-3 rounded-xl flex flex-col justify-center">
                  <span className="text-[11px] text-[#65676B]">Total Estimasi Pembelian PO:</span>
                  <div className="text-base font-bold text-[#050505] mt-0.5">
                    Rp {totalCalculatedPO.toLocaleString("id-ID")}
                  </div>
                  <span className="text-[10px] text-[#65676B] mt-0.5">
                    Total: {poItems.reduce((s, it) => s + (it.quantityOrdered || 0), 0)} eksemplar
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#E4E6EB] flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreatePOModalOpen(false)}
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
        </div>
      )}

      {/* MODAL 2: CREATE NEW SUPPLIER */}
      {isCreateSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#E7F3FF] text-[#1877F2] flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#050505]">Tambah Vendor / Supplier Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateSupplierModalOpen(false)}
                className="text-[#65676B] hover:text-[#050505] p-1 rounded-lg hover:bg-[#F0F2F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreateSupplier} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#050505] mb-1">Kode Supplier *</label>
                <input
                  type="text"
                  placeholder="Contoh: SUP-ERL, MENTARI-ID"
                  value={newSupplierCode}
                  onChange={(e) => setNewSupplierCode(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] uppercase font-mono focus:outline-hidden focus:border-[#1877F2]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#050505] mb-1">Nama Perusahaan / Penerbit *</label>
                <input
                  type="text"
                  placeholder="Contoh: Penerbit Erlangga Pusat"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#050505] mb-1">Kontak Person</label>
                  <input
                    type="text"
                    placeholder="Bpk/Ibu PIC"
                    value={newSupplierContact}
                    onChange={(e) => setNewSupplierContact(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#050505] mb-1">No. Telepon / WA</label>
                  <input
                    type="text"
                    placeholder="0812xxxx"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#050505] mb-1">Email</label>
                <input
                  type="email"
                  placeholder="sales@supplier.co.id"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#050505] mb-1">Alamat Kantor / Gudang</label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap supplier..."
                  value={newSupplierAddress}
                  onChange={(e) => setNewSupplierAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateSupplierModalOpen(false)}
                  className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] rounded-xl font-semibold text-[#65676B] transition-colors active:scale-[0.98]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSupplier}
                  className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-[0.98] disabled:opacity-50"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{isSubmittingSupplier ? "Menyimpan..." : "Daftarkan Supplier"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: INBOUND PHYSICAL RECEIVING */}
      {activeReceivingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#050505]">Penerimaan Barang Fisik (Inbound Receiving)</h3>
                <p className="text-[11px] text-[#65676B]">Otomatis buat barcode fisik & tambahkan ke stok satuan</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceivingPO(null)}
                className="text-[#65676B] hover:text-[#050505] p-1 rounded-lg hover:bg-[#F0F2F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReceive} className="p-6 space-y-4 text-xs">
              <div className="bg-[#F0F2F5] p-3 rounded-xl flex justify-between">
                <span>No. PO: <strong className="font-mono">{activeReceivingPO.poNumber}</strong></span>
                <span>Supplier: <strong>{activeReceivingPO.supplierName}</strong></span>
              </div>

              <div>
                <label className="block font-semibold mb-2 text-[#050505]">
                  Input Jumlah Buku yang Diterima Hari Ini:
                </label>
                <div className="space-y-2.5 max-h-56 overflow-y-auto">
                  {activeReceivingPO.items.map((it) => {
                    const remaining = Math.max(0, it.quantityOrdered - it.quantityReceived);

                    return (
                      <div
                        key={it.id}
                        className="p-3 bg-white border border-[#CED0D4] rounded-xl flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[#050505] truncate">{it.title}</div>
                          <div className="text-[10px] text-[#65676B]">
                            Telah diterima: {it.quantityReceived} dari total {it.quantityOrdered} eks
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

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2 text-[11px]">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#1877F2] mt-0.5" />
                <span>
                  Buku yang dikonfirmasi akan langsung otomatis dibuatkan ID barcode lepasan dengan kondisi <strong>Baru (new)</strong> di gudang <strong>{activeReceivingPO.schoolName}</strong>.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveReceivingPO(null)}
                  className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] rounded-xl font-semibold text-[#65676B] transition-colors active:scale-[0.98]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReceive}
                  className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-[0.98] disabled:opacity-50"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>{isSubmittingReceive ? "Menyimpan..." : "Konfirmasi Masuk Stok Satuan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
