/**
 * Adapter tipis portal seragam di atas fetch kanonik (`lib/api`).
 * Tanpa state, tanpa hitung total — hanya pemetaan endpoint dengan pesan Indonesia.
 */
import { buildQuery, getJson, postJson } from "../../lib/api";
import type { UniformCatalog, SubmitUniformOrderPayload, UniformStudent } from "../../lib/uniform-types";
import type { SchoolOption } from "../../lib/portal-types";

export const fetchUniformSchools = (): Promise<SchoolOption[]> =>
  getJson<SchoolOption[]>("/api/schools", "Gagal memuat daftar sekolah.");

export interface UniformStudentSearchParams {
  query: string;
  schoolId: string;
}

export const searchUniformStudents = (
  paramsOrQuery: UniformStudentSearchParams | string,
  legacySchoolId?: string
): Promise<UniformStudent[]> => {
  const params: UniformStudentSearchParams =
    typeof paramsOrQuery === "string"
      ? { query: paramsOrQuery, schoolId: legacySchoolId ?? "" }
      : paramsOrQuery;

  return getJson<UniformStudent[]>(
    buildQuery("/api/public/uniform-orders/search-students", {
      query: params.query.trim(),
      schoolId: params.schoolId,
    }),
    "Gagal melakukan pencarian siswa."
  );
};

export const fetchUniformCatalog = (academicYear: string): Promise<UniformCatalog> =>
  getJson<UniformCatalog>(
    buildQuery("/api/public/uniform-orders/catalog", { academicYear }),
    "Gagal memuat katalog seragam."
  );

export const fetchUniformSatuanStatus = (): Promise<{ open: boolean }> =>
  getJson<{ open: boolean }>("/api/public/uniform-orders/satuan-status", "Gagal memuat status satuan.");

export interface SubmittedUniformOrder {
  order: { id: string; orderNumber: string; shipmentStatus: string };
  totalAmount: number;
}

export const submitUniformOrder = (payload: SubmitUniformOrderPayload): Promise<SubmittedUniformOrder> =>
  postJson<SubmittedUniformOrder>("/api/public/uniform-orders/orders", payload, "Gagal memproses pesanan seragam.");

export interface UniformLookupOrder {
  id: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  schoolId: string;
  academicYear: string;
  shipmentStatus: "belum_dikirim" | "sudah_dikirim";
  shippedAt: string | null;
  totalAmount: number;
  createdAt: string;
}

export interface UniformLookupItem {
  id: string;
  orderId: string;
  packageId: string | null;
  variantId: string | null;
  size: string;
  quantity: number;
  unitPriceSnapshot: number;
}

export const lookupUniformOrders = (params: { orderNumber?: string; studentId?: string; schoolId?: string }): Promise<{
  orders: UniformLookupOrder[];
  items: UniformLookupItem[];
  itemsByOrder: Record<string, UniformLookupItem[]>;
}> =>
  getJson(buildQuery("/api/public/uniform-orders/lookup-order", params), "Pesanan tidak ditemukan.");

export const requestUniformExchange = (payload: {
  orderId: string; studentId: string;
  oldVariantId: string; oldSize: string;
  newVariantId: string; newSize: string; reason: string;
}): Promise<unknown> =>
  postJson("/api/public/uniform-orders/exchange-requests", payload, "Gagal mengajukan tukar ukuran.");

export const requestUniformRefund = (payload: {
  orderId: string; studentId: string; amount?: number; reason: string;
}): Promise<unknown> =>
  postJson("/api/public/uniform-orders/refund-requests", payload, "Gagal mengajukan refund.");
