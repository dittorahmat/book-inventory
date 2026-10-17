/**
 * Adapter staf untuk review bukti pembayaran order buku (client-side).
 * Tanpa state — hanya pemetaan endpoint ke tipe review bersama.
 */
import { getJson, postJson } from "../../lib/api";
import {
  isPendingPayment,
  normalizePaymentRow,
  type PaymentReviewResult,
  type PaymentReviewSnapshot,
  type RawPaymentRow,
} from "../../lib/payment-review-types";

interface OrderPaymentsResponse {
  payments?: RawPaymentRow[];
  pendingCount?: number;
  remainingAmount?: number;
}

/** GET /api/payments/orders/:orderId — riwayat klaim + sisa tagihan. */
export const fetchOrderPayments = async (orderId: string): Promise<PaymentReviewSnapshot> => {
  const data = await getJson<OrderPaymentsResponse>(
    `/api/payments/orders/${orderId}`,
    "Gagal memuat bukti pembayaran."
  );
  const raw = data.payments ?? [];
  return {
    payments: raw.map(normalizePaymentRow),
    pendingCount: data.pendingCount ?? raw.filter(isPendingPayment).length,
    remainingAmount: data.remainingAmount ?? null,
  };
};

/** POST verify — body kosong; hasil memuat status notifikasi WA/email. */
export const verifyOrderPayment = (orderId: string, paymentId: string): Promise<PaymentReviewResult> =>
  postJson<PaymentReviewResult>(
    `/api/payments/orders/${orderId}/payments/${paymentId}/verify`,
    {},
    "Gagal memverifikasi pembayaran."
  );

/** POST reject — alasan wajib diisi staf. */
export const rejectOrderPayment = (
  orderId: string,
  paymentId: string,
  reason: string
): Promise<PaymentReviewResult> =>
  postJson<PaymentReviewResult>(
    `/api/payments/orders/${orderId}/payments/${paymentId}/reject`,
    { reason },
    "Gagal menolak pembayaran."
  );
