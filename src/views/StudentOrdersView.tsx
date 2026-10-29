import { useState } from "react";
import type { School } from "../types";
import { Search, RefreshCw, AlertCircle } from "lucide-react";
import { SearchableSingleSelect } from "../components/ui/SearchableSingleSelect";
import { useStudentOrders } from "../components/orders/useStudentOrders";
import { StudentOrdersTable } from "../components/orders/StudentOrdersTable";
import { ShippingModal } from "../components/orders/ShippingModal";
import { CashierPaymentModal } from "../components/orders/CashierPaymentModal";
import { ScholarshipApprovalModal } from "../components/orders/ScholarshipApprovalModal";
import { OrderHandoverModal } from "../components/orders/OrderHandoverModal";
import { FinanceDiscretionModal } from "../components/orders/FinanceDiscretionModal";
import { PaymentReviewModal } from "../components/orders/PaymentReviewModal";
import { fetchOrderPayments, verifyOrderPayment, rejectOrderPayment } from "../components/orders/payment-review-api";
import type { StudentOrder } from "../components/orders/order-types";

interface StudentOrdersViewProps {
  activeSchool: School | null;
}

export function StudentOrdersView({ activeSchool }: StudentOrdersViewProps) {
  const {
    filteredOrders,
    isLoading,
    searchQuery,
    setSearchQuery,
    paymentFilter,
    setPaymentFilter,
    fulfillmentFilter,
    setFulfillmentFilter,
    errorMsg,
    loadOrders,
    removeOrder,
    markSatuanShipped,
    saveShipping,
    sendInvoice,
  } = useStudentOrders(activeSchool?.id ?? null);

  const [activePaymentOrder, setActivePaymentOrder] = useState<StudentOrder | null>(null);
  const [activeShippingOrder, setActiveShippingOrder] = useState<StudentOrder | null>(null);
  const [activeScholarshipOrder, setActiveScholarshipOrder] = useState<StudentOrder | null>(null);
  const [activeHandoverOrder, setActiveHandoverOrder] = useState<StudentOrder | null>(null);
  const [activeDiscretionOrder, setActiveDiscretionOrder] = useState<StudentOrder | null>(null);
  const [activeReviewOrder, setActiveReviewOrder] = useState<StudentOrder | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-[#050505]">Pesanan Buku Siswa</h1>
          <p className="text-xs text-[#65676B]">
            Kelola transaksi, status bayar & serah terima buku &bull; {activeSchool?.name || "Semua Sekolah"}
          </p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          className="px-3.5 py-2 bg-white border border-[#CED0D4] hover:bg-[#F0F2F5] active:scale-[0.98] text-[#050505] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#1877F2] ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari Kode Bukti Pengambilan / No. Order, nama murid, atau NIS..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E4E6EB] rounded-xl text-xs text-[#050505]"
          />
        </div>
        <div className="w-full sm:w-52">
          <SearchableSingleSelect
            options={[
              { value: "all", label: "Semua Status Bayar" },
              { value: "unpaid", label: "Belum Bayar" },
              { value: "partial", label: "Cicilan (Parsial)" },
              { value: "paid", label: "Lunas" },
              { value: "scholarship_pending", label: "Verifikasi Beasiswa" },
            ]}
            value={paymentFilter}
            onChange={setPaymentFilter}
            placeholder="Filter bayar..."
          />
        </div>
        <div className="w-full sm:w-52">
          <SearchableSingleSelect
            options={[
              { value: "all", label: "Semua Status Buku" },
              { value: "waiting_preparation", label: "Belum Diambil" },
              { value: "picked_up", label: "Sudah Diambil" },
            ]}
            value={fulfillmentFilter}
            onChange={setFulfillmentFilter}
            placeholder="Filter buku..."
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] p-10 text-center text-xs text-[#65676B]">
          Memuat data pesanan buku siswa...
        </div>
      ) : (
        <StudentOrdersTable
          orders={filteredOrders}
          onOpenPayment={setActivePaymentOrder}
          onOpenScholarship={setActiveScholarshipOrder}
          onOpenHandover={setActiveHandoverOrder}
          onOpenDiscretion={setActiveDiscretionOrder}
          onDeleteOrder={removeOrder}
          onMarkSatuanShipped={markSatuanShipped}
          onOpenShipping={setActiveShippingOrder}
          onSendInvoice={sendInvoice}
          onReviewPayments={setActiveReviewOrder}
        />
      )}

      {activeShippingOrder && (
        <ShippingModal
          order={activeShippingOrder}
          onClose={() => setActiveShippingOrder(null)}
          onSave={saveShipping}
        />
      )}

      {activePaymentOrder && (
        <CashierPaymentModal
          order={activePaymentOrder}
          onClose={() => setActivePaymentOrder(null)}
          onSuccess={loadOrders}
        />
      )}

      {activeScholarshipOrder && (
        <ScholarshipApprovalModal
          order={activeScholarshipOrder}
          onClose={() => setActiveScholarshipOrder(null)}
          onSuccess={loadOrders}
        />
      )}

      {activeHandoverOrder && (
        <OrderHandoverModal
          order={activeHandoverOrder}
          onClose={() => setActiveHandoverOrder(null)}
          onSuccess={loadOrders}
        />
      )}

      {activeDiscretionOrder && (
        <FinanceDiscretionModal
          order={activeDiscretionOrder}
          onClose={() => setActiveDiscretionOrder(null)}
          onSuccess={loadOrders}
        />
      )}

      {activeReviewOrder && (
        <PaymentReviewModal
          heading={`Order ${activeReviewOrder.orderNumber}`}
          subheading={`${activeReviewOrder.studentName} · ${activeReviewOrder.packageName || "-"}`}
          load={() => fetchOrderPayments(activeReviewOrder.id)}
          verify={(paymentId) => verifyOrderPayment(activeReviewOrder.id, paymentId)}
          reject={(paymentId, reason) => rejectOrderPayment(activeReviewOrder.id, paymentId, reason)}
          onClose={() => setActiveReviewOrder(null)}
          onChanged={loadOrders}
        />
      )}
    </div>
  );
}
