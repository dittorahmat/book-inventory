import { getJson, postJson, buildQuery } from "../../lib/api";
import type { InternalOrder, InternalPoLine, InternalShipment, PackageOption } from "../../lib/internal-orders-types";

/** Seam HTTP pesanan internal: daftar Internal PO, buat Internal PO, riwayat pengiriman, katalog paket. */
export const fetchInternalOrders = (schoolId?: string | null): Promise<InternalOrder[]> =>
  getJson<InternalOrder[]>(
    buildQuery("/api/internal-orders", { schoolId }),
    "Gagal memuat daftar pesanan ke gudang."
  );

export const fetchInternalShipments = (orderId: string): Promise<InternalShipment[]> =>
  getJson<InternalShipment[]>(
    `/api/internal-orders/${encodeURIComponent(orderId)}/shipments`,
    "Gagal memuat riwayat pengiriman."
  );

export const fetchPackageOptions = (): Promise<PackageOption[]> =>
  getJson<PackageOption[]>("/api/packages", "Gagal memuat katalog paket.");

export const createInternalOrder = (payload: {
  schoolId: string;
  notes?: string;
  items: InternalPoLine[];
}): Promise<{ id: string; poNumber: string }> =>
  postJson<{ id: string; poNumber: string }>(
    "/api/internal-orders",
    payload,
    "Gagal membuat pesanan ke gudang."
  );
