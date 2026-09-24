import { useState, useEffect, useCallback } from "react";
import { School } from "../types";
import { 
  Search, 
  RefreshCw, 
  Award, 
  Truck, 
  Printer, 
  X
} from "lucide-react";

interface StudentOrder {
  id: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  nis: string;
  gradeLevel: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  schoolId: string;
  packageId?: string;
  packageName?: string;
  packageCode?: string;
  orderType: "regular" | "scholarship";
  paymentStatus: "unpaid" | "partial" | "paid" | "scholarship_pending" | "scholarship_approved" | "scholarship_rejected";
  fulfillmentStatus: "waiting_preparation" | "ready_for_pickup" | "picked_up" | "return_in_progress";
  totalAmount: number;
  paidAmount: number;
  handoverDeliveryNumber?: string;
  handoverDate?: string;
  handoverRecipient?: string;
  scholarshipProofUrl?: string;
  notes?: string;
  createdAt: string;
}

interface StudentOrdersViewProps {
  activeSchool: School | null;
}

export function StudentOrdersView({ activeSchool }: StudentOrdersViewProps) {
  const [orders, setOrders] = useState<StudentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");

  // Modals
  const [activePaymentOrder, setActivePaymentOrder] = useState<StudentOrder | null>(null);
  const [activeHandoverOrder, setActiveHandoverOrder] = useState<StudentOrder | null>(null);
  const [activeScholarshipOrder, setActiveScholarshipOrder] = useState<StudentOrder | null>(null);

  // Form states
  const [cashierTransferAmount, setCashierTransferAmount] = useState(0);
  const [cashierBookAllocation, setCashierBookAllocation] = useState(0);
  const [cashierBankName, setCashierBankName] = useState("BCA");
  const [cashierRefNo, setCashierRefNo] = useState("");
  const [handoverRecipient, setHandoverRecipient] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!activeSchool) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/student-orders?schoolId=${activeSchool.id}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (err) {
      console.error("Failed to load student orders", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeSchool]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.nis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPayment = paymentFilter === "all" || o.paymentStatus === paymentFilter;
    const matchesFulfillment = fulfillmentFilter === "all" || o.fulfillmentStatus === fulfillmentFilter;

    return matchesSearch && matchesPayment && matchesFulfillment;
  });

  // Cashier Payment Submit
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaymentOrder) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/payments/orders/${activePaymentOrder.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transferAmount: cashierTransferAmount,
          bookAllocationAmount: cashierBookAllocation,
          bankName: cashierBankName,
          referenceNumber: cashierRefNo,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Gagal mencatat pembayaran");
      setActivePaymentOrder(null);
      loadOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Scholarship Action
  const handleScholarshipAction = async (action: "approve" | "reject") => {
    if (!activeScholarshipOrder) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/payments/orders/${activeScholarshipOrder.id}/scholarship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Gagal memproses approval");
      setActiveScholarshipOrder(null);
      loadOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handover Submit
  const handleHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHandoverOrder) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/student-orders/${activeHandoverOrder.id}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: handoverRecipient,
          notes: handoverNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Gagal memproses serah terima");
      setActiveHandoverOrder(null);
      loadOrders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Editorial Header */}
      <div className="bg-white rounded-2xl p-5 border border-[#E4E6EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-md">
              Fulfillment & Kasir
            </span>
            <span className="text-xs text-[#65676B]">&bull; {activeSchool?.name || "Pilih Cabang"}</span>
          </div>
          <h1 className="text-xl font-bold text-[#050505] tracking-tight mt-1">
            Matriks Pemesanan Siswa & Serah Terima Buku
          </h1>
          <p className="text-xs text-[#65676B] max-w-2xl mt-0.5">
            Pelacakan status murid (pembayaran lunas/parsial/beasiswa) dan status penyerahan fisik paket buku (surat jalan serah terima).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => loadOrders()}
            className="p-2.5 rounded-xl border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
          <input
            type="text"
            placeholder="Cari murid, NIS, no. pesanan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] placeholder-[#65676B] focus:outline-hidden focus:border-[#1877F2]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-semibold text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
          >
            <option value="all">Semua Status Bayar</option>
            <option value="unpaid">Belum Bayar (Unpaid)</option>
            <option value="partial">Cicilan (Partial)</option>
            <option value="paid">Lunas (Paid)</option>
            <option value="scholarship_pending">Beasiswa (Menunggu Verifikasi)</option>
            <option value="scholarship_approved">Beasiswa (Approved 100%)</option>
          </select>

          <select
            value={fulfillmentFilter}
            onChange={(e) => setFulfillmentFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-semibold text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
          >
            <option value="all">Semua Status Serah</option>
            <option value="waiting_preparation">Belum Diambil</option>
            <option value="ready_for_pickup">Siap Diambil</option>
            <option value="picked_up">Sudah Ambil (Selesai)</option>
            <option value="return_in_progress">Retur Cacat</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F8FA] border-b border-[#E4E6EB] text-[#65676B] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Murid & No. Pesanan</th>
                <th className="py-3 px-4">Paket Buku</th>
                <th className="py-3 px-4">Status Pembayaran</th>
                <th className="py-3 px-4">Status Fisik Buku</th>
                <th className="py-3 px-4 text-right">Aksi Operasional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EB]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#65676B]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-[#1877F2]" />
                    Memuat daftar pemesanan murid...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#65676B]">
                    Tidak ada pesanan murid yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isPaidOrScholarship =
                    o.paymentStatus === "paid" || o.paymentStatus === "scholarship_approved";
                  const isPickedUp = o.fulfillmentStatus === "picked_up";

                  return (
                    <tr key={o.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-sm text-[#050505]">{o.studentName}</div>
                        <div className="text-[11px] text-[#65676B] flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono bg-[#F0F2F5] px-1.5 py-0.5 rounded text-[10px]">
                            {o.nis}
                          </span>
                          <span>&bull;</span>
                          <span>Kelas {o.gradeLevel}</span>
                          <span>&bull;</span>
                          <span className="font-mono text-[10px] text-[#1877F2]">{o.orderNumber}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#050505]">{o.packageName || "Paket Khusus"}</div>
                        <div className="text-[11px] text-[#65676B]">
                          Tagihan: <span className="font-semibold text-[#050505]">Rp {o.totalAmount.toLocaleString("id-ID")}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {o.paymentStatus === "paid" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              LUNAS (Rp {o.paidAmount.toLocaleString("id-ID")})
                            </span>
                          )}
                          {o.paymentStatus === "partial" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              CICILAN (Terbayar: Rp {o.paidAmount.toLocaleString("id-ID")})
                            </span>
                          )}
                          {o.paymentStatus === "unpaid" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-50 text-red-700 border border-red-200">
                              BELUM BAYAR
                            </span>
                          )}
                          {o.paymentStatus === "scholarship_pending" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                              <Award className="w-3 h-3" /> BEASISWA PENDING
                            </span>
                          )}
                          {o.paymentStatus === "scholarship_approved" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                              <Award className="w-3 h-3" /> BEASISWA 100% (FREE)
                            </span>
                          )}

                          {o.orderType === "regular" && o.paymentStatus !== "paid" && (
                            <button
                              onClick={() => {
                                setActivePaymentOrder(o);
                                setCashierTransferAmount(o.totalAmount - o.paidAmount);
                                setCashierBookAllocation(o.totalAmount - o.paidAmount);
                              }}
                              className="text-[11px] text-[#1877F2] hover:underline font-semibold"
                            >
                              + Verifikasi Bayar
                            </button>
                          )}

                          {o.paymentStatus === "scholarship_pending" && (
                            <button
                              onClick={() => setActiveScholarshipOrder(o)}
                              className="text-[11px] text-purple-700 hover:underline font-semibold"
                            >
                              Periksa Bukti Beasiswa &rarr;
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isPickedUp ? (
                          <div>
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              SUDAH DIAMBIL
                            </span>
                            <div className="text-[10px] font-mono text-[#65676B] mt-1">
                              {o.handoverDeliveryNumber}
                            </div>
                            <div className="text-[10px] text-[#65676B]">
                              Penerima: {o.handoverRecipient || "-"}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-700">
                              BELUM DIAMBIL
                            </span>
                            <div className="text-[10px] text-[#65676B] mt-0.5">
                              {isPaidOrScholarship ? "Siap diserahkan" : "Menunggu pelunasan"}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {!isPickedUp ? (
                          <button
                            onClick={() => {
                              setActiveHandoverOrder(o);
                              setHandoverRecipient(o.parentName || o.studentName);
                            }}
                            className="px-3 py-1.5 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-xl text-xs transition-colors shadow-2xs inline-flex items-center gap-1.5"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Serahkan Buku</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => window.print()}
                            className="px-3 py-1.5 bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#050505] font-semibold rounded-xl text-xs transition-colors inline-flex items-center gap-1.5"
                            title="Cetak Surat Jalan Serah Terima"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#65676B]" />
                            <span>Surat Jalan</span>
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

      {/* CASHIER VERIFY PAYMENT MODAL */}
      {activePaymentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#050505]">Verifikasi Pembayaran Kasir</h3>
              <button onClick={() => setActivePaymentOrder(null)} className="text-[#65676B] hover:text-[#050505]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4 text-xs">
              {errorMsg && <div className="text-red-600 bg-red-50 p-2 rounded-lg">{errorMsg}</div>}
              <div>
                <span className="text-[#65676B]">Murid:</span>{" "}
                <span className="font-bold text-[#050505]">{activePaymentOrder.studentName}</span>
              </div>
              <div className="flex justify-between bg-[#F0F2F5] p-3 rounded-xl">
                <span>Total Tagihan: Rp {activePaymentOrder.totalAmount.toLocaleString("id-ID")}</span>
                <span className="font-bold text-[#1877F2]">
                  Sisa: Rp {(activePaymentOrder.totalAmount - activePaymentOrder.paidAmount).toLocaleString("id-ID")}
                </span>
              </div>
              <div>
                <label className="block font-semibold mb-1">Nominal Struk Transfer Bank (Rp)</label>
                <input
                  type="number"
                  required
                  value={cashierTransferAmount}
                  onChange={(e) => setCashierTransferAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl font-semibold"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Alokasi Khusus untuk Buku Ini (Rp)</label>
                <input
                  type="number"
                  required
                  value={cashierBookAllocation}
                  onChange={(e) => setCashierBookAllocation(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl font-bold text-[#1877F2]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Bank</label>
                <input
                  type="text"
                  value={cashierBankName}
                  onChange={(e) => setCashierBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Nomor Referensi Transfer</label>
                <input
                  type="text"
                  value={cashierRefNo}
                  onChange={(e) => setCashierRefNo(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
                  placeholder="TRX-129381923"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActivePaymentOrder(null)}
                  className="px-4 py-2 bg-[#F0F2F5] rounded-xl font-semibold text-[#65676B]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#1877F2] text-white rounded-xl font-semibold"
                >
                  {isSubmitting ? "Menyimpan..." : "Konfirmasi Pembayaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHOLARSHIP APPROVAL MODAL */}
      {activeScholarshipOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#050505]">Pemeriksaan Surat Beasiswa</h3>
              <button onClick={() => setActiveScholarshipOrder(null)} className="text-[#65676B] hover:text-[#050505]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <span className="text-[#65676B]">Murid:</span>{" "}
                <span className="font-bold text-[#050505]">{activeScholarshipOrder.studentName}</span>
              </div>
              {activeScholarshipOrder.scholarshipProofUrl ? (
                <div>
                  <span className="font-semibold block mb-1">Lampiran Berkas:</span>
                  <img
                    src={activeScholarshipOrder.scholarshipProofUrl}
                    alt="Bukti beasiswa"
                    className="h-44 w-full object-contain rounded-xl border border-[#E4E6EB] bg-gray-50 p-1"
                  />
                </div>
              ) : (
                <div className="p-4 bg-amber-50 text-amber-700 rounded-xl">
                  Tidak ada foto bukti beasiswa yang dilampirkan.
                </div>
              )}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleScholarshipAction("reject")}
                  className="px-4 py-2 bg-red-50 text-red-700 rounded-xl font-semibold hover:bg-red-100"
                >
                  Tolak Beasiswa
                </button>
                <button
                  type="button"
                  onClick={() => handleScholarshipAction("approve")}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700"
                >
                  Setujui Beasiswa (100% Free)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HANDOVER SURAT JALAN MODAL */}
      {activeHandoverOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#050505]">Serah Terima Buku & Terbitkan Surat Jalan</h3>
              <button onClick={() => setActiveHandoverOrder(null)} className="text-[#65676B] hover:text-[#050505]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleHandoverSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <span className="text-[#65676B]">Murid:</span>{" "}
                <span className="font-bold text-[#050505]">{activeHandoverOrder.studentName}</span>
              </div>
              <div>
                <span className="text-[#65676B]">Paket:</span>{" "}
                <span className="font-semibold text-[#050505]">{activeHandoverOrder.packageName}</span>
              </div>
              <div>
                <label className="block font-semibold mb-1">Nama Penerima Buku (Orang Tua / Siswa)</label>
                <input
                  type="text"
                  required
                  value={handoverRecipient}
                  onChange={(e) => setHandoverRecipient(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
                  placeholder="Contoh: Hendra Wahyudi (Ayah)"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Catatan Serah Terima (Opsional)</label>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
                  placeholder="Diserahkan dalam kondisi baik dan tersegel rapi..."
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveHandoverOrder(null)}
                  className="px-4 py-2 bg-[#F0F2F5] rounded-xl font-semibold text-[#65676B]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#1877F2] text-white rounded-xl font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Memproses..." : "Konfirmasi & Terbitkan Surat Jalan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
