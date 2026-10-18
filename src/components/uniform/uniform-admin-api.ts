/**
 * Adapter tipis staf seragam di atas fetch kanonik (`lib/api`).
 * Tanpa state — hanya pemetaan endpoint dengan pesan Indonesia.
 */
import { buildQuery, getJson, postJson } from "../../lib/api";
import {
  isPendingPayment,
  normalizePaymentRow,
  type PaymentReviewResult,
  type PaymentReviewSnapshot,
  type RawPaymentRow,
} from "../../lib/payment-review-types";

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
  paidAmount?: number;
  paymentStatus?: string;
  orderType?: string;
  stage?: string;
  shippingCost?: number;
  shippingResi?: string | null;
  invoiceSentAt?: string | null;
  homeAddressSnapshot: string;
  /** Jumlah klaim bukti bayar ortu yang masih menunggu verifikasi staf. */
  pendingCount?: number;
  createdAt: string;
}

export const fetchUniformOrders = (params: { schoolId?: string; shipmentStatus?: string; search?: string }): Promise<UniformOrderRow[]> =>
  getJson<UniformOrderRow[]>(buildQuery("/api/uniforms/orders", params), "Gagal memuat order seragam.");

export const markUniformShipped = (id: string): Promise<UniformOrderRow> =>
  postJson<UniformOrderRow>(`/api/uniforms/orders/${id}/ship`, {}, "Gagal menandai kiriman.");

export const saveUniformShipping = (id: string, shippingCost: number, shippingResi?: string): Promise<UniformOrderRow> =>
  postJson<UniformOrderRow>(`/api/uniforms/orders/${id}/shipping`, { shippingCost, shippingResi }, "Gagal menyimpan ongkir.");

export const sendUniformInvoice = (id: string): Promise<{ order: UniformOrderRow; confirmUrl: string }> =>
  postJson<{ order: UniformOrderRow; confirmUrl: string }>(`/api/uniforms/orders/${id}/send-invoice`, {}, "Gagal mengirim invoice.");

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
  order: UniformOrderRow & { academicYear: string; notes: string | null; payments?: RawPaymentRow[] };
  items: Array<{ id: string; packageId: string | null; variantId: string | null; size: string; quantity: number; unitPriceSnapshot: number }>;
}

export const fetchUniformOrderDetail = (id: string): Promise<UniformOrderDetail> =>
  getJson<UniformOrderDetail>(`/api/uniforms/orders/${id}`, "Gagal memuat detail order.");

/** Detail order → baris review bukti bayar (alokasi seragam dinormalisasi bersama kanal buku). */
export const fetchUniformOrderPayments = async (id: string): Promise<PaymentReviewSnapshot> => {
  const detail = await fetchUniformOrderDetail(id);
  const raw = detail.order.payments ?? [];
  return {
    payments: raw.map(normalizePaymentRow),
    pendingCount: detail.order.pendingCount ?? raw.filter(isPendingPayment).length,
    remainingAmount: null,
  };
};

export const verifyUniformPayment = (orderId: string, paymentId: string): Promise<PaymentReviewResult> =>
  postJson<PaymentReviewResult>(
    `/api/uniforms/orders/${orderId}/payments/${paymentId}/verify`,
    {},
    "Gagal memverifikasi pembayaran seragam."
  );

export const rejectUniformPayment = (
  orderId: string,
  paymentId: string,
  reason: string
): Promise<PaymentReviewResult> =>
  postJson<PaymentReviewResult>(
    `/api/uniforms/orders/${orderId}/payments/${paymentId}/reject`,
    { reason },
    "Gagal menolak pembayaran seragam."
  );

/** Input bayar kasir manual untuk order seragam (tunai/transfer). */
export const payUniformOrder = (
  orderId: string,
  payload: { transferAmount: number; allocationAmount: number; bankName: string; referenceNumber?: string }
): Promise<PaymentReviewResult> =>
  postJson<PaymentReviewResult>(
    `/api/uniforms/orders/${orderId}/pay`,
    payload,
    "Gagal mencatat pembayaran seragam."
  );

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

export interface UniformSalesReport {
  period: { from: string; to: string };
  totals: { orderCount: number; studentCount: number; quantity: number; revenue: number };
  rows: Array<{
    schoolId: string; schoolName: string; jenjang: string; size: string;
    orderCount: number; studentCount: number; quantity: number; revenue: number;
  }>;
}

export const fetchUniformSalesReport = (params: { schoolId?: string; from?: string; to?: string; jenjang?: string; size?: string; gender?: string; paymentStatus?: string; shipmentStatus?: string }): Promise<UniformSalesReport> =>
  getJson<UniformSalesReport>(buildQuery("/api/uniforms/reports/sales", params), "Gagal memuat laporan seragam.");

export const downloadUniformSalesCsv = (params: { schoolId?: string; from?: string; to?: string; jenjang?: string; size?: string; gender?: string; paymentStatus?: string; shipmentStatus?: string }): void => {
  window.location.href = `/api/uniforms/reports/sales-csv${buildQuery("", params)}`;
};

export interface UniformClaimRow {
  id: string; claimNumber: string; schoolId: string; period: string;
  status: "draft" | "locked"; totalQty: number; totalAmount: number; lockedAt: string | null;
  goodsAmount: number; shippingAmount: number;
  /** Selisih angka klaim vs tagihan di bawahnya; bukan 0 = berubah setelah dibuat. */
  driftAmount?: number;
}

export const fetchUniformClaims = (schoolId?: string): Promise<UniformClaimRow[]> =>
  getJson<UniformClaimRow[]>(buildQuery("/api/uniforms/claims", { schoolId }), "Gagal memuat klaim.");

export const createUniformClaim = (schoolId: string, period: string): Promise<UniformClaimRow> =>
  postJson<UniformClaimRow>("/api/uniforms/claims", { schoolId, period }, "Gagal membuat klaim.");

export const lockUniformClaim = (id: string): Promise<UniformClaimRow> =>
  postJson<UniformClaimRow>(`/api/uniforms/claims/${id}/lock`, {}, "Gagal mengunci klaim.");

export const adjustUniformStock = (payload: { variantId: string; size?: string; quantity: number; mode: "add" | "set"; reason: string }): Promise<unknown> =>
  postJson("/api/uniforms/stock/adjust", payload, "Gagal menyesuaikan stok.");

export interface UniformRejectRow {
  id: string; variantId: string; size: string; quantity: number; reason: string; createdAt: string;
}

export const fetchUniformRejects = (): Promise<UniformRejectRow[]> =>
  getJson<UniformRejectRow[]>("/api/uniforms/rejects", "Gagal memuat catatan reject.");

export const createUniformReject = (payload: { variantId: string; size?: string; quantity: number; reason: string }): Promise<unknown> =>
  postJson("/api/uniforms/rejects", payload, "Gagal menyimpan reject.");

export const resolveUniformScholarship = (id: string, action: "approve" | "reject"): Promise<unknown> =>
  postJson(`/api/uniforms/orders/${id}/scholarship`, { action }, "Gagal memproses beasiswa.");

export const downloadUniformCsv = async (params: { schoolId: string; format: "packing" | "ekspedisi"; paidOnly?: boolean }): Promise<void> => {
  const res = await fetch(buildQuery("/api/uniforms/orders/export", { ...params, paidOnly: String(params.paidOnly ?? true) }));
  if (!res.ok) throw new Error("Gagal mengunduh data.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `seragam-${params.format}-${params.schoolId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importUniformShipping = (payload: { schoolId: string; markShipped?: boolean; rows: Array<{ nis: string; resi?: string; ongkir?: number }> }): Promise<{ updated: string[]; rejected: Array<{ nis: string; reason: string }> }> =>
  postJson("/api/uniforms/orders/import-shipping", payload, "Gagal mengimpor data ekspedisi.");
