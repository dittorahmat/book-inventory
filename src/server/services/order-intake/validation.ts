import type { ContentfulStatusCode } from "hono/utils/http-status";
import { calcHeaderTotal } from "../../../lib/transfer-pricing";
import { eligibilityStatus, evaluateStudentEligibility } from "../student-eligibility";

export type ValidationError = { ok: false; status: ContentfulStatusCode; message: string };

/** Adapter buku: aturan kelayakan tinggal di student-eligibility, bentuk hasil lama dipertahankan. */
export function validateStudentForOrder<T extends { status: string }>(
  student: T | undefined
): { ok: true; student: T } | ValidationError {
  if (!student) return { ok: false, status: 404, message: "Data murid tidak ditemukan" };
  const eligibility = evaluateStudentEligibility(student);
  return eligibility.ok
    ? { ok: true, student }
    : { ok: false, status: eligibilityStatus(eligibility.reason), message: eligibility.message };
}

/** Order satuan menuntut periode cut-off terbuka. Murni: tanpa DB, tanpa jam. */
export function validateSatuanCutoff(
  hasLooseItems: boolean,
  status: { open: boolean; reason: string }
): { ok: true } | ValidationError {
  if (hasLooseItems && !status.open) {
    return { ok: false, status: 403, message: `Order satuan sedang ditutup. ${status.reason}` };
  }
  return { ok: true };
}

export interface PaymentDerivation {
  totalAmount: number;
  paidAmount: number;
  paymentStatus: "unpaid" | "partial" | "paid" | "scholarship_approved";
}

/** Status pembayaran awal dari nominal kotor dan alokasi transfer orang tua. Murni: tanpa DB.
 * Sesuai model rekonsiliasi buku (ADR-0018):
 * - Beasiswa langsung diakui sebagai scholarship_approved (validasi kelengkapan dokumen dijalankan oleh validateScholarshipProof).
 * - Pembayaran reguler dengan nominal transfer yang dialokasikan:
 *   - allocationAmount >= grossAmount: "paid", paidAmount mencatat nominal riil yang dialokasikan (tanpa pemotongan).
 *   - 0 < allocationAmount < grossAmount: "partial", paidAmount = allocationAmount.
 *   - allocationAmount <= 0 / tanpa bukti: "unpaid", paidAmount = 0.
 */
export function derivePaymentStatus(input: {
  isScholarship: boolean;
  grossAmount: number;
  allocationAmount?: number;
}): PaymentDerivation {
  if (input.isScholarship) {
    return { totalAmount: 0, paidAmount: 0, paymentStatus: "scholarship_approved" };
  }
  const allocated = Math.max(0, input.allocationAmount ?? 0);
  if (allocated >= input.grossAmount && input.grossAmount > 0) {
    return { totalAmount: input.grossAmount, paidAmount: allocated, paymentStatus: "paid" };
  }
  if (allocated > 0) {
    return { totalAmount: input.grossAmount, paidAmount: allocated, paymentStatus: "partial" };
  }
  return { totalAmount: input.grossAmount, paidAmount: 0, paymentStatus: "unpaid" };
}

export const MIN_ORDER_BOOK_QTY = 1;
export const MAX_ORDER_BOOK_QTY = 50;

/** Order harus memuat paket atau minimal satu judul satuan dengan jumlah valid. Murni: tanpa DB. */
export function validateOrderLines(
  packageId: string | undefined,
  looseItems: Array<{ bookId: string; quantity: number }> | undefined
): { ok: true } | ValidationError {
  const lines = looseItems ?? [];
  return !packageId && lines.length === 0
    ? { ok: false, status: 400, message: "Pilih paket atau minimal satu judul buku satuan" }
    : lines.some((l) => !l.bookId || !Number.isInteger(l.quantity) || l.quantity < MIN_ORDER_BOOK_QTY || l.quantity > MAX_ORDER_BOOK_QTY)
      ? { ok: false, status: 400, message: `Jumlah minimal ${MIN_ORDER_BOOK_QTY} dan maksimal ${MAX_ORDER_BOOK_QTY} per judul buku` }
      : { ok: true };
}

/** Paket yang diminta harus ada. Murni: tanpa DB (baris sudah di-fetch pemanggil). */
export function validatePackageForOrder<T extends { id: string }>(
  pkg: T | undefined,
  packageId: string | undefined
): { ok: true; pkg: T | undefined } | ValidationError {
  return packageId && !pkg
    ? { ok: false, status: 404, message: "Paket buku tidak ditemukan" }
    : { ok: true, pkg };
}

/** Seluruh judul satuan yang diminta harus ada. Murni: tanpa DB. */
export function validateLooseBooks(
  requestedIds: string[],
  foundIds: ReadonlySet<string>
): { ok: true } | ValidationError {
  return requestedIds.some((id) => !foundIds.has(id))
    ? { ok: false, status: 404, message: "Judul buku tidak ditemukan" }
    : { ok: true };
}

/** Bukti beasiswa wajib untuk order beasiswa. Murni: tanpa DB. */
export function validateScholarshipProof(
  isScholarship: boolean,
  proof: string | null | undefined
): { ok: true } | ValidationError {
  return isScholarship && !proof
    ? { ok: false, status: 400, message: "Surat tanda beasiswa wajib dilampirkan" }
    : { ok: true };
}

/** Bukti transfer wajib untuk order reguler. Murni: tanpa DB. */
export function validatePaymentProof(
  isRegular: boolean,
  proof: string | null | undefined
): { ok: true } | ValidationError {
  return isRegular && !proof
    ? { ok: false, status: 400, message: "Bukti transfer pembayaran wajib dilampirkan" }
    : { ok: true };
}

/** Total kotor = harga paket + subtotal satuan (seam harga snapshot). */
export function grossOrderAmount(packagePrice: number, looseLines: Array<{ unitPrice: number; quantity: number }>): number {
  return packagePrice + calcHeaderTotal(looseLines.map((l) => ({ unitPriceSnapshot: l.unitPrice, quantity: l.quantity })));
}
