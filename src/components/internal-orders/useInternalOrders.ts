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

  const submitPoShipment = useCallback(
    async (
      poId: string,
      payload: {
        deliveryNoteNumber: string;
        shippedDate?: string;
        notes?: string;
        items: Array<{ packageId?: string; quantity: number; isOutstandingFollowup?: boolean }>;
      }
    ) => {
      const res = await postJson<{ shipmentId: string; status: string }>(
        `/api/internal-orders/${encodeURIComponent(poId)}/shipments`,
        payload,
        "Gagal menerbitkan Surat Jalan internal."
      );
      await loadOrders();
      await loadShipments(poId);
      return res;
    },
    [loadOrders, loadShipments]
  );

  const submitManualShipment = useCallback(
    async (payload: {
      destinationSchoolId: string;
      deliveryNoteNumber: string;
      shippedDate?: string;
      notes?: string;
      items: Array<{ packageId?: string; quantity: number }>;
    }) => {
      const res = await postJson<{ shipmentId: string }>(
        "/api/internal-orders/shipments/manual",
        payload,
        "Gagal menerbitkan Surat Jalan manual."
      );
      await loadOrders();
      return res;
    },
    [loadOrders]
  );

  return {
    orders,
    isLoading,
    loadError,
    loadData,
    submitOrder,
    submitPoShipment,
    submitManualShipment,
    shipmentsByOrder,
    shipmentsLoading,
    shipmentsError,
    loadShipments,
  };
}
