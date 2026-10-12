/**
 * Adapter tipis staf seragam di atas fetch kanonik (`lib/api`).
 * Tanpa state — hanya pemetaan endpoint dengan pesan Indonesia.
 */
import { buildQuery, getJson, postJson } from "../../lib/api";

export interface UniformOrderRow {
  id: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  nis: string;
  gradeLevel: string;
  schoolId: string;
  schoolName: string;
  shipmentStatus: "belum_dikirim" | "sudah_dikirim";
  shippedAt: string | null;
  totalAmount: number;
  homeAddressSnapshot: string;
  createdAt: string;
}

export const fetchUniformOrders = (params: { schoolId?: string; shipmentStatus?: string; search?: string }): Promise<UniformOrderRow[]> =>
  getJson<UniformOrderRow[]>(buildQuery("/api/uniforms/orders", params), "Gagal memuat order seragam.");

export const markUniformShipped = (id: string): Promise<UniformOrderRow> =>
  postJson<UniformOrderRow>(`/api/uniforms/orders/${id}/ship`, {}, "Gagal menandai kiriman.");

export interface UniformVariantRow {
  variant: {
    id: string; code: string; name: string; kind: string; gender: string;
    jenjang: string; academicYear: string; price: number; sizeChartUrl: string | null;
  };
  sizes: string[];
  stock: Array<{ size: string; quantity: number }>;
}

export const fetchUniformVariants = (): Promise<UniformVariantRow[]> =>
  getJson<UniformVariantRow[]>("/api/uniforms/variants", "Gagal memuat varian seragam.");

export const createUniformVariant = (payload: unknown): Promise<unknown> =>
  postJson("/api/uniforms/variants", payload, "Gagal membuat varian seragam.");

export interface UniformPackageRow {
  package: { id: string; code: string; name: string; academicYear: string; price: number };
  bom: Array<{ variantId: string; variantName: string; kind: string; size: string; quantity: number }>;
  readyQty: number;
}

export const fetchUniformPackages = (): Promise<UniformPackageRow[]> =>
  getJson<UniformPackageRow[]>("/api/uniforms/packages", "Gagal memuat paket seragam.");

export const createUniformPackage = (payload: unknown): Promise<unknown> =>
  postJson("/api/uniforms/packages", payload, "Gagal membuat paket seragam.");

export const assembleUniformPackage = (id: string, quantity: number, sizeOverrides?: Record<string, string>): Promise<unknown> =>
  postJson(`/api/uniforms/packages/${id}/assemble`, { quantity, sizeOverrides }, "Gagal merakit paket.");

export const fetchUniformPos = (): Promise<Array<{ id: string; poNumber: string; status: string; totalAmount: number }>> =>
  getJson("/api/uniforms/pos", "Gagal memuat PO seragam.");

export const createUniformPo = (payload: unknown): Promise<{ id: string }> =>
  postJson<{ id: string }>("/api/uniforms/pos", payload, "Gagal membuat PO seragam.");

export const receiveUniformPo = (id: string, lines: Array<{ variantId: string; size?: string; quantity: number }>): Promise<unknown> =>
  postJson(`/api/uniforms/pos/${id}/receive`, { lines }, "Gagal mencatat penerimaan PO.");

export interface UniformOrderDetail {
  order: UniformOrderRow & { academicYear: string; notes: string | null };
  items: Array<{ id: string; packageId: string | null; variantId: string | null; size: string; quantity: number; unitPriceSnapshot: number }>;
}

export const fetchUniformOrderDetail = (id: string): Promise<UniformOrderDetail> =>
  getJson<UniformOrderDetail>(`/api/uniforms/orders/${id}`, "Gagal memuat detail order.");

export interface UniformExchangeRow {
  id: string; orderId: string; oldVariantId: string; oldSize: string;
  newVariantId: string; newSize: string; reason: string; status: string;
}

export const fetchUniformExchanges = (params: { schoolId?: string; status?: string }): Promise<UniformExchangeRow[]> =>
  getJson<UniformExchangeRow[]>(buildQuery("/api/uniforms/exchanges", params), "Gagal memuat tukar ukuran.");

export const requestUniformExchange = (payload: unknown): Promise<unknown> =>
  postJson("/api/uniforms/exchanges", payload, "Gagal mengajukan tukar ukuran.");

export const resolveUniformExchange = (id: string, action: "approve" | "complete" | "reject"): Promise<unknown> =>
  postJson(`/api/uniforms/exchanges/${id}/resolve`, { action }, "Gagal memproses tukar ukuran.");

export interface UniformRefundRow {
  id: string; orderId: string; refundNumber: string; amount: number; reason: string; status: string;
}

export const fetchUniformRefunds = (params: { schoolId?: string; status?: string }): Promise<UniformRefundRow[]> =>
  getJson<UniformRefundRow[]>(buildQuery("/api/uniforms/refunds", params), "Gagal memuat refund.");

export const requestUniformRefund = (payload: unknown): Promise<unknown> =>
  postJson("/api/uniforms/refunds", payload, "Gagal mengajukan refund.");

export const resolveUniformRefund = (id: string, action: "approve" | "refund" | "reject"): Promise<unknown> =>
  postJson(`/api/uniforms/refunds/${id}/resolve`, { action }, "Gagal memproses refund.");
