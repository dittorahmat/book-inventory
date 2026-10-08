import { formatRupiah } from "../../lib/transfer-pricing";
import type { FinalOrderPayload } from "./portal-api";

export interface OrderTotalsInput {
  studentId: string;
  packageMode: boolean;
  packageId?: string;
  packagePrice: number;
  looseItems: Array<{ bookId: string; quantity: number }>;
  looseTotal: number;
  orderType: "regular" | "scholarship";
  scholarshipProofBase64: string;
  transferAmount: number;
  bookAllocationAmount: number;
  bankName: string;
  referenceNumber: string;
  paymentProofBase64: string;
  notes: string;
}

/**
 * Pembangun payload order final yang murni (tanpa fetch, tanpa state).
 * Satu-satunya pemilik aturan normalisasi: alokasi pembayaran yang tidak
 * sama dengan total tagihan DITOLAK dengan pesan eksplisit — tidak pernah
 * ditulis ulang diam-diam — agar orang tua memeriksa lalu kirim ulang.
 */
export function buildFinalOrderPayload(input: OrderTotalsInput): FinalOrderPayload {
  const looseItems = input.looseItems.filter((s) => s.quantity > 0);
  if (input.packageMode && !input.packageId) {
    throw new Error("Paket buku belum terkunci. Pilih siswa kembali dari langkah pertama.");
  }
  if (!input.packageMode && looseItems.length === 0) {
    throw new Error("Pilih minimal 1 buku satuan sebelum melanjutkan pembayaran.");
  }
  if (input.orderType === "scholarship" && !input.scholarshipProofBase64) {
    throw new Error("Dokumen bukti surat tanda beasiswa wajib dilampirkan.");
  }

  const bookTotal = input.packageMode ? input.packagePrice : input.looseTotal;
  if (input.orderType === "regular" && input.bookAllocationAmount > 0 && input.bookAllocationAmount !== bookTotal) {
    throw new Error(
      `Alokasi buku ${formatRupiah(input.bookAllocationAmount)} tidak sama dengan total tagihan ${formatRupiah(bookTotal)}. Sesuaikan nominal lalu kirim ulang.`
    );
  }

  return {
    studentId: input.studentId,
    ...(input.packageMode ? { packageId: input.packageId } : { looseItems }),
    orderType: input.orderType,
    notes: input.notes.trim() || undefined,
    ...(input.orderType === "scholarship" ? { scholarshipProofBase64: input.scholarshipProofBase64 } : {}),
    ...(input.orderType === "regular" && input.bookAllocationAmount > 0
      ? {
          payment: {
            transferAmount: input.transferAmount || input.bookAllocationAmount,
            bookAllocationAmount: input.bookAllocationAmount,
            bankName: input.bankName,
            referenceNumber: input.referenceNumber || undefined,
            paymentProofBase64: input.paymentProofBase64 || undefined,
          },
        }
      : {}),
  };
}
