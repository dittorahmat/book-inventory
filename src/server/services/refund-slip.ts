import { desc, eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { refundSlips } from "../../db/schema";

/**
 * Satu-satunya pemilik Slip Bukti Pengembalian (ADR-0019): baris slip
 * diterbitkan saat gudang menyetujui retur, dibaca antrean Finance, lalu
 * ditandai cair. Metadata resi/surat tinggal di kolom tabel ini, bukan JSON
 * di system_settings (AGENTS §0.10/§0.34).
 */

export type RefundSlipKind = "buku" | "seragam";
export type RefundSlipRow = typeof refundSlips.$inferSelect;

export interface RefundSlipInput {
  kind: RefundSlipKind;
  slipNumber: string;
  orderId: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  nis: string;
  schoolId: string;
  refundAmount: number;
  courierResi?: string | null;
  letterProofUrl?: string | null;
  approvedAt: string;
}

/** Query insert untuk ditempel ke batch atomik pemanggil (bukan tulis sendiri). */
export const refundSlipInsertQuery = (database: AppDatabase, input: RefundSlipInput) =>
  database.insert(refundSlips).values({
    id: input.slipNumber,
    kind: input.kind,
    slipNumber: input.slipNumber,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    studentId: input.studentId,
    studentName: input.studentName,
    nis: input.nis,
    schoolId: input.schoolId,
    refundAmount: input.refundAmount,
    status: "approved",
    courierResi: input.courierResi?.trim() || null,
    letterProofUrl: input.letterProofUrl ?? null,
    approvedAt: input.approvedAt,
    createdAt: input.approvedAt,
    updatedAt: input.approvedAt,
  });

export const findRefundSlip = async (
  database: AppDatabase,
  slipNumber: string
): Promise<RefundSlipRow | null> => {
  const [row] = await database.select().from(refundSlips).where(eq(refundSlips.slipNumber, slipNumber));
  return row ?? null;
};

/** Antrean Finance: satu query terindeks, bukan prefix-scan + N+1. */
export const listRefundSlips = (database: AppDatabase, schoolId?: string): Promise<RefundSlipRow[]> =>
  database
    .select()
    .from(refundSlips)
    .where(schoolId ? eq(refundSlips.schoolId, schoolId) : undefined)
    .orderBy(desc(refundSlips.approvedAt));

export interface RefundDisbursement {
  bankName: string;
  referenceNumber: string;
  proofUrl?: string | null;
  notes?: string | null;
  now: string;
}

/** Query penandaan cair; ditempel ke batch finansial pemanggil. */
export const refundSlipDisbursedQuery = (
  database: AppDatabase,
  slipNumber: string,
  input: RefundDisbursement
) =>
  database
    .update(refundSlips)
    .set({
      status: "refunded",
      disbursedAt: input.now,
      disbursedBankName: input.bankName,
      disbursedReferenceNumber: input.referenceNumber,
      disbursedProofUrl: input.proofUrl ?? null,
      disbursedNotes: input.notes?.trim() || null,
      updatedAt: input.now,
    })
    .where(eq(refundSlips.slipNumber, slipNumber));
