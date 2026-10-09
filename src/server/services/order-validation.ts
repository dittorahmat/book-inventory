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

/** Order harus memuat paket atau minimal satu judul satuan dengan jumlah valid. Murni: tanpa DB. */
export function validateOrderLines(
  packageId: string | undefined,
  looseItems: Array<{ bookId: string; quantity: number }> | undefined
): { ok: true } | ValidationError {
  const lines = looseItems ?? [];
  return !packageId && lines.length === 0
    ? { ok: false, status: 400, message: "Pilih paket atau minimal satu judul buku satuan" }
    : lines.some((l) => !l.bookId || !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 50)
      ? { ok: false, status: 400, message: "Jumlah minimal 1 dan maksimal 50 per judul buku" }
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

/** Total kotor = harga paket + subtotal satuan (seam harga snapshot). */
export function grossOrderAmount(packagePrice: number, looseLines: Array<{ unitPrice: number; quantity: number }>): number {
  return packagePrice + calcHeaderTotal(looseLines.map((l) => ({ unitPriceSnapshot: l.unitPrice, quantity: l.quantity })));
}
