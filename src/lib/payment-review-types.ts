/**
 * Seam bersama review bukti pembayaran ortu (buku & seragam).
 * Satu normalizer + satu ringkasan notifikasi dipakai kedua kanal agar kanal
 * buku (`bookAllocationAmount`) dan seragam (`uniformAllocationAmount`) tampil
 * identik di satu modal (AGENTS.md §8 — dilarang helper duplikat).
 */

export type PaymentReviewStatus = "pending" | "verified" | "rejected";

/** Bentuk mentah PaymentRow dari API (sebagian field opsional antar-kanal). */
export interface RawPaymentRow {
  id: string;
  transferAmount?: number | null;
  bookAllocationAmount?: number | null;
  uniformAllocationAmount?: number | null;
  paymentProofUrl?: string | null;
  bankName?: string | null;
  referenceNumber?: string | null;
  verifiedAt?: string | null;
  rejectedAt?: string | null;
  rejectReason?: string | null;
  notes?: string | null;
  createdAt: string;
  status?: string | null;
}

/** Baris pembayaran ternormalisasi untuk modal review. */
export interface PaymentReviewRow {
  id: string;
  transferAmount: number;
  allocationAmount: number;
  paymentProofUrl: string | null;
  bankName: string | null;
  referenceNumber: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  notes: string | null;
  createdAt: string;
  status: PaymentReviewStatus;
}

/** Normalizer tunggal PaymentRow → baris review (status tak dikenal = pending). */
export const normalizePaymentRow = (row: RawPaymentRow): PaymentReviewRow => ({
  id: row.id,
  transferAmount: row.transferAmount ?? 0,
  allocationAmount: row.bookAllocationAmount ?? row.uniformAllocationAmount ?? 0,
  paymentProofUrl: row.paymentProofUrl ?? null,
  bankName: row.bankName ?? null,
  referenceNumber: row.referenceNumber ?? null,
  verifiedAt: row.verifiedAt ?? null,
  rejectedAt: row.rejectedAt ?? null,
  rejectReason: row.rejectReason ?? null,
  notes: row.notes ?? null,
  createdAt: row.createdAt,
  status: row.status === "verified" || row.status === "rejected" ? row.status : "pending",
});

export const isPendingPayment = (row: RawPaymentRow): boolean =>
  normalizePaymentRow(row).status === "pending";

export interface PaymentNotificationOutcome {
  success: boolean;
  error?: string;
}

export interface PaymentNotification {
  wa: PaymentNotificationOutcome;
  email: PaymentNotificationOutcome;
}

export interface PaymentReviewResult {
  notification?: PaymentNotification;
}

export interface PaymentReviewSnapshot {
  payments: PaymentReviewRow[];
  pendingCount: number;
  remainingAmount: number | null;
}

/** Ringkasan notifikasi untuk toast eksplisit — dilarang diam saat kirim gagal (§5). */
export const formatNotification = (
  action: "verifikasi" | "tolak",
  notification?: PaymentNotification
): string => {
  const label = action === "verifikasi" ? "Pembayaran terverifikasi." : "Pembayaran ditolak.";
  if (!notification) return `${label} Notifikasi tidak tersedia.`;
  const part = (name: string, outcome?: PaymentNotificationOutcome): string =>
    !outcome
      ? `${name}: tidak dikirim`
      : outcome.success
        ? `${name}: terkirim`
        : `${name} gagal: ${outcome.error || "tanpa keterangan"}`;
  return `${label} ${part("WA", notification.wa)}, ${part("Email", notification.email)}.`;
};
