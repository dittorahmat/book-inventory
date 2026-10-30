import { eq, like } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  bookReturns,
  studentBookOrders,
  systemSettings,
  uniformRefunds,
} from "../../db/schema";
import { formatRupiah } from "../../lib/transfer-pricing";
import { BOOK_WITHDRAWAL_KEY_PREFIX, type BookWithdrawalSlip } from "./book-withdrawal";
import { UNIFORM_WITHDRAWAL_KEY_PREFIX, type UniformWithdrawalSlip } from "./uniform-withdrawal";
import { buildReceiptDraft, receiptWriteQueries } from "./payment-ledger";
import { d1WriteErrorStatus, newWriteId, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";

export interface RefundQueueItem {
  id: string; // returnId or refundId
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

export async function listFinanceRefundQueue(
  database: AppDatabase,
  schoolId?: string
): Promise<RefundQueueItem[]> {
  const items: RefundQueueItem[] = [];

  // 1. Slip Buku
  const bookSlips = await database
    .select()
    .from(systemSettings)
    .where(like(systemSettings.key, `${BOOK_WITHDRAWAL_KEY_PREFIX}%`));

  for (const row of bookSlips) {
    try {
      const slip = JSON.parse(row.value) as BookWithdrawalSlip;
      if (schoolId && slip.schoolId !== schoolId) continue;

      // Cari status pengembalian terkini dari bookReturns
      const [br] = await database
        .select()
        .from(bookReturns)
        .where(eq(bookReturns.orderId, slip.orderId));

      const status = br?.status === "refunded" ? "refunded" : "approved";

      items.push({
        id: br?.id ?? slip.orderId,
        kind: "buku",
        slipNumber: slip.slipNumber,
        orderId: slip.orderId,
        orderNumber: slip.orderNumber,
        studentId: slip.studentId,
        studentName: slip.studentName,
        nis: slip.nis,
        schoolId: slip.schoolId,
        refundAmount: slip.refundAmount,
        approvedAt: slip.approvedAt,
        status,
      });
    } catch {
      // Abaikan slip corrupt
    }
  }

  // 2. Slip Seragam
  const uniformSlips = await database
    .select()
    .from(systemSettings)
    .where(like(systemSettings.key, `${UNIFORM_WITHDRAWAL_KEY_PREFIX}%`));

  for (const row of uniformSlips) {
    try {
      const slip = JSON.parse(row.value) as UniformWithdrawalSlip;
      if (schoolId && slip.schoolId !== schoolId) continue;

      const [ur] = await database
        .select()
        .from(uniformRefunds)
        .where(eq(uniformRefunds.orderId, slip.orderId));

      const status = ur?.status === "refunded" ? "refunded" : "approved";

      items.push({
        id: ur?.id ?? slip.orderId,
        kind: "seragam",
        slipNumber: slip.slipNumber,
        orderId: slip.orderId,
        orderNumber: slip.orderNumber,
        studentId: slip.studentId,
        studentName: slip.studentName,
        nis: slip.nis,
        schoolId: slip.schoolId,
        refundAmount: slip.refundAmount,
        approvedAt: slip.approvedAt,
        status,
        courierResi: slip.courierResi,
      });
    } catch {
      // Abaikan slip corrupt
    }
  }

  // Urutkan paling baru
  return items.sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
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

  const settingKey =
    input.kind === "buku"
      ? `${BOOK_WITHDRAWAL_KEY_PREFIX}${input.slipNumber}`
      : `${UNIFORM_WITHDRAWAL_KEY_PREFIX}${input.slipNumber}`;

  const [row] = await database.select().from(systemSettings).where(eq(systemSettings.key, settingKey));
  if (!row) {
    return { ok: false, status: 404, message: "Slip pengembalian dana tidak ditemukan" };
  }

  let slip: BookWithdrawalSlip | UniformWithdrawalSlip;
  try {
    slip = JSON.parse(row.value);
  } catch {
    return { ok: false, status: 400, message: "Format slip tidak valid" };
  }

  // Catat struk keluar (refund transfer) lewat payment-ledger kanonik
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

  const writeOps: unknown[] = [...receiptWriteQueries(database, built.draft)];

  if (input.kind === "buku") {
    // 1. Update book_returns status -> refunded
    writeOps.push(
      database
        .update(bookReturns)
        .set({ status: "refunded", updatedAt: now })
        .where(eq(bookReturns.orderId, slip.orderId))
    );
    // 2. Set student_book_orders fulfillmentStatus -> return_in_progress / unassigned
    writeOps.push(
      database
        .update(studentBookOrders)
        .set({ fulfillmentStatus: "return_in_progress", updatedAt: now })
        .where(eq(studentBookOrders.id, slip.orderId))
    );
  } else {
    // 1. Update uniform_refunds status -> refunded
    writeOps.push(
      database
        .update(uniformRefunds)
        .set({ status: "refunded", updatedAt: now })
        .where(eq(uniformRefunds.orderId, slip.orderId))
    );
  }

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
