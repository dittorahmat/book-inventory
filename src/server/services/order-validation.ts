import type { ContentfulStatusCode } from "hono/utils/http-status";
import { calcHeaderTotal } from "../../lib/transfer-pricing";

export type ValidationError = { ok: false; status: ContentfulStatusCode; message: string };

/** Siswa boleh order bila ada dan berstatus aktif/promosi. Murni: tanpa DB. */
export function validateStudentForOrder<T extends { status: string }>(
  student: T | undefined
): { ok: true; student: T } | ValidationError {
  if (!student) {
    return { ok: false, status: 404, message: "Data murid tidak ditemukan" };
  }
  if (student.status !== "active" && student.status !== "promoted") {
    return {
      ok: false,
      status: 403,
      message: "Data siswa masih menunggu verifikasi admin sekolah. Silakan coba lagi setelah disetujui.",
    };
  }
  return { ok: true, student };
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
  paymentStatus: string;
}

/** Status pembayaran dari nominal kotor + alokasi. Murni: tanpa DB. */
export function derivePaymentStatus(input: {
  isScholarship: boolean;
  grossAmount: number;
  bookAllocationAmount: number;
}): PaymentDerivation {
  const totalAmount = input.isScholarship ? 0 : input.grossAmount;
  if (input.isScholarship) {
    return { totalAmount, paidAmount: 0, paymentStatus: "scholarship_pending" };
  }
  if (input.bookAllocationAmount > 0) {
    const paidAmount = input.bookAllocationAmount;
    return { totalAmount, paidAmount, paymentStatus: paidAmount >= totalAmount ? "paid" : "partial" };
  }
  return { totalAmount, paidAmount: 0, paymentStatus: "unpaid" };
}

/** Total kotor = harga paket + subtotal satuan (seam harga snapshot). */
export function grossOrderAmount(packagePrice: number, looseLines: Array<{ unitPrice: number; quantity: number }>): number {
  return packagePrice + calcHeaderTotal(looseLines.map((l) => ({ unitPriceSnapshot: l.unitPrice, quantity: l.quantity })));
}
