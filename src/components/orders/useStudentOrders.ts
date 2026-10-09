import { useState, useCallback, useEffect } from "react";
import { buildQuery, getJson, delJson } from "../../lib/api";
import type { StudentOrder } from "./order-types";

export function useStudentOrders(schoolId: string | null) {
  const [orders, setOrders] = useState<StudentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!schoolId) return;
    setIsLoading(true);
    try {
      setOrders(
        await getJson<StudentOrder[]>(
          buildQuery("/api/student-orders", { schoolId }),
          "Gagal memuat pesanan siswa."
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memuat pesanan siswa.");
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

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

  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      o.studentName.toLowerCase().includes(q) ||
      o.nis.toLowerCase().includes(q) ||
      o.orderNumber.toLowerCase().includes(q);

    const matchesPayment = paymentFilter === "all" || o.paymentStatus === paymentFilter;
    const matchesFulfillment = fulfillmentFilter === "all" || o.fulfillmentStatus === fulfillmentFilter;

    return matchesSearch && matchesPayment && matchesFulfillment;
  });

  return {
    orders,
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
  };
}
