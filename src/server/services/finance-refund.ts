import { formatRupiah } from "../../lib/transfer-pricing";
import type { AppDatabase } from "../../db";
import { buildReceiptDraft, receiptWriteQueries } from "./payment-ledger";
import {
  findRefundSlip,
  listRefundSlips,
  refundSlipDisbursedQuery,
  type RefundSlipRow,
} from "./refund-slip";
import { markBookReturnRefundedQueries } from "./return/fulfilment";
import { markUniformRefundRefundedQuery } from "./uniform/returns";
import { d1WriteErrorStatus, newWriteId, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";

export interface RefundQueueItem {
  id: string;
  kind: "buku" | "seragam";
  slipNumber: string;
  orderId: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  nis: string;
  schoolId: string;
  refundAmount: number;
  approvedAt: string;
  status: "approved" | "refunded";
  courierResi?: string;
  disbursedAt?: string;
  bankName?: string;
  referenceNumber?: string;
}

/** Baris antrean = baris slip; tidak ada status yang ditebak dari tabel lain. */
const toQueueItem = (slip: RefundSlipRow): RefundQueueItem => ({
  id: slip.id,
  kind: slip.kind,
  slipNumber: slip.slipNumber,
  orderId: slip.orderId,
  orderNumber: slip.orderNumber,
  studentId: slip.studentId,
  studentName: slip.studentName,
  nis: slip.nis,
  schoolId: slip.schoolId,
  refundAmount: slip.refundAmount,
  approvedAt: slip.approvedAt,
  status: slip.status,
  courierResi: slip.courierResi ?? undefined,
  disbursedAt: slip.disbursedAt ?? undefined,
  bankName: slip.disbursedBankName ?? undefined,
  referenceNumber: slip.disbursedReferenceNumber ?? undefined,
});

export async function listFinanceRefundQueue(
  database: AppDatabase,
  schoolId?: string
): Promise<RefundQueueItem[]> {
  const slips = await listRefundSlips(database, schoolId);
  return slips.map(toQueueItem);
}

export interface DisburseRefundInput {
  kind: "buku" | "seragam";
  slipNumber: string;
  bankName: string;
  referenceNumber: string;
  proofUrl?: string;
  notes?: string;
}

export async function disburseFinanceRefund(
  database: AppDatabase,
  input: DisburseRefundInput,
  actorUserId?: string,
  deps?: WriteDeps
): Promise<
  | { ok: true; receiptId: string; message: string }
  | { ok: false; status: 400 | 404 | 409 | 500; message: string }
> {
  const now = writeNow(deps);
  if (!input.bankName?.trim() || !input.referenceNumber?.trim()) {
    return { ok: false, status: 400, message: "Bank dan Nomor Referensi transfer refund wajib diisi" };
  }

  const slip = await findRefundSlip(database, input.slipNumber);
  if (!slip) {
    return { ok: false, status: 404, message: "Slip pengembalian dana tidak ditemukan" };
  }
  if (slip.kind !== input.kind) {
    return { ok: false, status: 400, message: "Jenis slip tidak sesuai dengan permintaan pencairan." };
  }
  if (slip.status === "refunded") {
    return { ok: false, status: 409, message: `Slip ${slip.slipNumber} sudah dicairkan.` };
  }

  // Catat struk keluar (refund transfer) lewat payment-ledger kanonik.
  const receiptId = newWriteId(deps);
  const built = buildReceiptDraft(
    {
      studentId: slip.studentId,
      schoolId: slip.schoolId,
      amount: slip.refundAmount,
      // Uang keluar: tidak boleh dibaca verifiedAllocationSum sebagai pembayaran.
      direction: "out",
      allocations: [
        {
          orderId: slip.orderId,
          kind: input.kind,
          amount: slip.refundAmount,
          billAmount: slip.refundAmount,
        },
      ],
      bankName: input.bankName.trim(),
      referenceNumber: input.referenceNumber.trim(),
      proofUrl: input.proofUrl,
      verifiedByUserId: actorUserId ?? null,
      autoVerify: true,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    },
    now,
    receiptId
  );

  if (!built.ok) {
    return { ok: false, status: built.status, message: built.message };
  }

  const writeOps: unknown[] = [
    ...receiptWriteQueries(database, built.draft),
    refundSlipDisbursedQuery(database, slip.slipNumber, {
      bankName: input.bankName.trim(),
      referenceNumber: input.referenceNumber.trim(),
      proofUrl: input.proofUrl,
      notes: input.notes,
      now,
    }),
    ...(input.kind === "buku"
      ? markBookReturnRefundedQueries(database, slip.orderId, now)
      : [markUniformRefundRefundedQuery(database, slip.orderId, now)]),
  ];

  try {
    await runWriteBatch(database, writeOps);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pencairan dana refund");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    receiptId,
    message: `Pencairan dana refund sebesar ${formatRupiah(slip.refundAmount)} untuk Slip ${slip.slipNumber} berhasil dicatat via payment-ledger.`,
  };
}
