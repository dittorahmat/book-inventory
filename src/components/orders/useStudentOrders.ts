import { useState, useCallback, useEffect } from "react";
import { buildQuery, apiEnvelope, delJson, postJson } from "../../lib/api";
import type { StudentOrder } from "./order-types";
import type { PaginationMeta } from "../ui/useTablePagination";
import { useDebouncedSearch } from "../../lib/useDebouncedSearch";

export function useStudentOrders(schoolId?: string | null) {
  const [orders, setOrders] = useState<StudentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { searchQuery, setSearchQuery, debouncedSearch } = useDebouncedSearch("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });

  // Reset page ke 1 setiap kali filter atau debounced query berubah
  useEffect(() => {
    setPage(1);
  }, [schoolId, paymentFilter, fulfillmentFilter, debouncedSearch]);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const envelope = await apiEnvelope<{ data: StudentOrder[]; pagination?: PaginationMeta }>(
        buildQuery("/api/student-orders", {
          schoolId: schoolId || undefined,
          paymentStatus: paymentFilter === "all" ? undefined : paymentFilter,
          fulfillmentStatus: fulfillmentFilter === "all" ? undefined : fulfillmentFilter,
          search: debouncedSearch.trim() || undefined,
          page,
          limit: 50,
        }),
        undefined,
        "Gagal memuat pesanan siswa."
      );

      const items = Array.isArray(envelope.data) ? envelope.data : [];
      setOrders(items);
      if (envelope.pagination) {
        setPagination(envelope.pagination);
      } else {
        setPagination({
          page: 1,
          limit: 50,
          total: items.length,
          totalPages: 1,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memuat pesanan siswa.");
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, paymentFilter, fulfillmentFilter, debouncedSearch, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const removeOrder = async (order: StudentOrder) => {
    if (
      !window.confirm(
        `Hapus pesanan ${order.orderNumber} (${order.studentName})? Data pesanan akan dihapus dari sistem.`
      )
    ) {
      return;
    }
    try {
      await delJson(`/api/student-orders/${order.id}`, "Gagal menghapus pesanan.");
      alert(`Pesanan ${order.orderNumber} berhasil dihapus.`);
      loadOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus pesanan.");
    }
  };

  const markSatuanShipped = async (order: StudentOrder) => {
    try {
      const data = await postJson<{ orderNumber: string }>(
        `/api/student-orders/${order.id}/mark-satuan-shipped`,
        {},
        "Gagal menandai satuan terkirim."
      );
      alert(`Satuan order ${order.orderNumber} ditandai sudah dikirim ke rumah.`);
      loadOrders();
      return data;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menandai satuan terkirim.");
      throw err;
    }
  };

  const saveShipping = async (order: StudentOrder, shippingCost: number, shippingResi?: string) => {
    try {
      await postJson(`/api/student-orders/${order.id}/shipping`, { shippingCost, shippingResi }, "Gagal menyimpan ongkir.");
      alert(`Ongkir ${order.orderNumber} tersimpan. Tombol kirim invoice kini aktif.`);
      loadOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan ongkir.");
      throw err;
    }
  };

  const sendInvoice = async (order: StudentOrder) => {
    if (!window.confirm(`Kirim invoice + link pembayaran ke ortu ${order.studentName} via WhatsApp?`)) return;
    try {
      await postJson(`/api/student-orders/${order.id}/send-invoice`, {}, "Gagal mengirim invoice.");
      alert(`Invoice ${order.orderNumber} terkirim via WhatsApp.`);
      loadOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengirim invoice.");
    }
  };

  return {
    orders,
    filteredOrders: orders,
    isLoading,
    searchQuery,
    setSearchQuery,
    paymentFilter,
    setPaymentFilter,
    fulfillmentFilter,
    setFulfillmentFilter,
    page,
    setPage,
    pagination,
    errorMsg,
    loadOrders,
    removeOrder,
    markSatuanShipped,
    saveShipping,
    sendInvoice,
  };
}
