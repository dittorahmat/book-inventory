import { useCallback, useEffect, useState } from "react";
import { getJson, postJson, buildQuery } from "../../lib/api";
import type { InternalOrder, InternalShipment } from "../../lib/internal-orders-types";

/** State pesanan internal cabang: daftar Internal PO + riwayat pengiriman per PO. */
export function useInternalOrders(schoolId?: string | null) {
  const [orders, setOrders] = useState<InternalOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shipmentsByOrder, setShipmentsByOrder] = useState<Record<string, InternalShipment[]>>({});
  const [shipmentsLoading, setShipmentsLoading] = useState<Record<string, boolean>>({});
  const [shipmentsError, setShipmentsError] = useState<Record<string, string | null>>({});

  const loadOrders = useCallback(async (): Promise<InternalOrder[]> => {
    const list = await getJson<InternalOrder[]>(
      buildQuery("/api/internal-orders", { schoolId }),
      "Gagal memuat daftar pesanan ke gudang."
    );
    setOrders(list);
    return list;
  }, [schoolId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      await loadOrders();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat pesanan ke gudang.");
    } finally {
      setIsLoading(false);
    }
  }, [loadOrders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadShipments = useCallback(async (orderId: string) => {
    setShipmentsLoading((prev) => ({ ...prev, [orderId]: true }));
    setShipmentsError((prev) => ({ ...prev, [orderId]: null }));
    try {
      const list = await getJson<InternalShipment[]>(
        `/api/internal-orders/${encodeURIComponent(orderId)}/shipments`,
        "Gagal memuat riwayat pengiriman."
      );
      setShipmentsByOrder((prev) => ({ ...prev, [orderId]: list }));
    } catch (err) {
      setShipmentsError((prev) => ({
        ...prev,
        [orderId]: err instanceof Error ? err.message : "Gagal memuat riwayat pengiriman.",
      }));
    } finally {
      setShipmentsLoading((prev) => ({ ...prev, [orderId]: false }));
    }
  }, []);

  const submitOrder = useCallback(
    async (payload: { schoolId: string; notes?: string; items: Array<{ packageId: string; quantityOrdered: number }> }) => {
      const created = await postJson<{ id: string; poNumber: string }>(
        "/api/internal-orders",
        payload,
        "Gagal membuat pesanan ke gudang."
      );
      await loadOrders();
      return created;
    },
    [loadOrders]
  );

  return {
    orders,
    isLoading,
    loadError,
    loadData,
    submitOrder,
    shipmentsByOrder,
    shipmentsLoading,
    shipmentsError,
    loadShipments,
  };
}
