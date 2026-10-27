import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppDatabase } from "../../db";
import { paymentAllocations, paymentReceipts, studentBookOrders, students, uniformOrders } from "../../db/schema";
import {
  d1WriteErrorStatus,
  newWriteId,
  runWriteBatch,
  selectInChunks,
  writeNow,
  type WriteDeps,
} from "../lib/d1-write";
import { dueOf } from "../../lib/order-money";
import { confirmUrlFor, ensurePaymentToken } from "./order-invoice";
import { notifyOrderPaidOff, notifyPaymentRejected, type NotifyDeps, type NotifyResult } from "./order-paid-notify";
import {
  buildReceiptDraft,
  creditParts,
  listPaymentRows,
  orderTableFor,
  paymentRowStatus,
  receiptNumberConflict,
  receiptWriteQueries,
  verifiedAllocationSum,
  type ListPaymentRow,
  type PaymentKind,
} from "./payment-ledger";

/**
 * Review bukti transfer gudang (buku | seragam). Satu struk bisa menutup
 * beberapa order; verifikasi mengkredit setiap order yang dialokasikan,
 * penolakan hanya menandai struk. Semua multi-tulis lewat `runWriteBatch` (§10).
 */

export type { PaymentKind };

export const rejectReasonSchema = z.object({
  reason: z.string().trim().min(1, "Alasan penolakan wajib diisi."),
});

export const cashierPaymentSchema = z
  .object({
    transferAmount: z.number().int().min(1, "Nominal transfer wajib diisi"),
    allocationAmount: z.number().int().min(1).optional(),
    bookAllocationAmount: z.number().int().min(1).optional(),
    bankName: z.string().optional(),
    referenceNumber: z.string().optional(),
    verifiedByUserId: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (v) => (v.allocationAmount !== undefined && v.allocationAmount >= 1) || (v.bookAllocationAmount !== undefined && v.bookAllocationAmount >= 1),
    { message: "Nominal alokasi wajib diisi" }
  );

type OrderRow = typeof studentBookOrders.$inferSelect | typeof uniformOrders.$inferSelect;

export type PaymentReviewError = { ok: false; status: 400 | 404 | 409; message: string };
export interface ReviewDeps extends WriteDeps, NotifyDeps {}

const invalid = (message: string): PaymentReviewError => ({ ok: false, status: 400, message });
const notFound = (message: string): PaymentReviewError => ({ ok: false, status: 404, message });

/** Kredit satu order dari struk; bentuknya seragam untuk buku dan seragam. */
type Credit =
  | { kind: "buku"; orderId: string; paidAmount: number; paymentStatus: typeof studentBookOrders.$inferSelect["paymentStatus"]; due: number }
  | { kind: "seragam"; orderId: string; paidAmount: number; paymentStatus: typeof uniformOrders.$inferSelect["paymentStatus"]; due: number };

const creditUpdateQuery = (database: AppDatabase, credit: Credit, now: string) =>
  credit.kind === "buku"
    ? database
        .update(studentBookOrders)
        .set({ paidAmount: credit.paidAmount, paymentStatus: credit.paymentStatus, updatedAt: now })
        .where(eq(studentBookOrders.id, credit.orderId))
    : database
        .update(uniformOrders)
        .set({ paidAmount: credit.paidAmount, paymentStatus: credit.paymentStatus, updatedAt: now })
        .where(eq(uniformOrders.id, credit.orderId));

/** Nama lama dipertahankan: pembaca baris struk kini milik ledger. */
export const listPaymentsWithStatus = listPaymentRows;

/** Hitung struk pending per order dalam satu grup-baca (bukan N+1). */
export const pendingPaymentCounts = async (
  database: AppDatabase,
  kind: PaymentKind,
  orderIds: string[]
): Promise<Map<string, number>> => {
  if (orderIds.length === 0) return new Map();
  const rows = await selectInChunks<{ orderId: string; count: number }>(orderIds, (chunk) =>
    database
      .select({ orderId: paymentAllocations.orderId, count: sql<number>`count(*)` })
      .from(paymentAllocations)
      .innerJoin(paymentReceipts, eq(paymentReceipts.id, paymentAllocations.receiptId))
      .where(
        and(
          eq(paymentAllocations.kind, kind),
          inArray(paymentAllocations.orderId, chunk),
          isNull(paymentReceipts.verifiedAt),
          isNull(paymentReceipts.rejectedAt)
        )
      )
      .groupBy(paymentAllocations.orderId)
  );
  return new Map(rows.map((r) => [r.orderId, Number(r.count)]));
};

const findOrder = async (database: AppDatabase, kind: PaymentKind, orderId: string): Promise<OrderRow | undefined> => {
  const table = orderTableFor(kind);
  const [order] = await database.select().from(table).where(eq(table.id, orderId));
  return order;
};

const findReceipt = async (database: AppDatabase, receiptId: string) => {
  const [receipt] = await database.select().from(paymentReceipts).where(eq(paymentReceipts.id, receiptId));
  return receipt;
};

const receiptAllocations = (database: AppDatabase, receiptId: string) =>
  database.select().from(paymentAllocations).where(eq(paymentAllocations.receiptId, receiptId));

const loadStudent = async (database: AppDatabase, studentId: string) => {
  const [student] = await database.select().from(students).where(eq(students.id, studentId));
  return student ?? { name: "Ananda", parentPhone: null, parentEmail: null };
};

export interface VerifyPaymentInput {
  kind: PaymentKind;
  orderId: string;
  paymentId: string;
  verifiedByUserId?: string | null;
  baseUrl?: string;
}

export interface VerifyPaymentSuccess {
  ok: true;
  data: {
    order: OrderRow;
    payment: ListPaymentRow | null;
    paymentStatus: string;
    paidAmount: number;
    remainingAmount: number;
    notification: NotifyResult | null;
  };
}

/** Verifikasi satu struk: kredit setiap order yang dialokasikan, lalu notifikasi bila lunas. */
export const verifyPayment = async (
  database: AppDatabase,
  input: VerifyPaymentInput,
  deps?: ReviewDeps
): Promise<VerifyPaymentSuccess | PaymentReviewError> => {
  const now = writeNow(deps);
  const order = await findOrder(database, input.kind, input.orderId);
  if (!order) return notFound("Pesanan tidak ditemukan.");
  const receipt = await findReceipt(database, input.paymentId);
  if (!receipt) return notFound("Bukti pembayaran tidak ditemukan.");
  const allocations = await receiptAllocations(database, receipt.id);
  if (!allocations.some((a) => a.kind === input.kind && a.orderId === input.orderId)) {
    return notFound("Bukti pembayaran tidak ditemukan.");
  }
  const lifecycle = paymentRowStatus(receipt);
  if (lifecycle === "verified") return invalid("Bukti pembayaran ini sudah diverifikasi sebelumnya.");
  if (lifecycle === "rejected") return invalid("Bukti pembayaran ini sudah ditolak. Minta orang tua mengunggah ulang.");

  // Hitung kredit semua order dulu, lalu tulis satu batch: struk + kreditnya
  // tidak boleh terpisah (struk verified tanpa order terkredit = angka liar).
  // `verifiedAllocationSum` belum menghitung struk ini (masih pending), jadi
  // kredit = jumlah lama + porsi struk ini.
  const credits: Credit[] = [];
  for (const allocation of allocations) {
    const alreadyPaid = await verifiedAllocationSum(database, allocation.kind, allocation.orderId);
    const paidAmount = alreadyPaid + allocation.amount;
    if (allocation.kind === "buku") {
      const [target] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, allocation.orderId));
      if (!target) continue;
      const { due, paymentStatus } = creditParts(target, paidAmount);
      credits.push({ kind: "buku", orderId: allocation.orderId, paidAmount, due, paymentStatus });
    } else {
      const [target] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, allocation.orderId));
      if (!target) continue;
      const { due, paymentStatus } = creditParts(target, paidAmount);
      credits.push({ kind: "seragam", orderId: allocation.orderId, paidAmount, due, paymentStatus });
    }
  }
  try {
    await runWriteBatch(database, [
      database
        .update(paymentReceipts)
        .set({ verifiedAt: now, verifiedByUserId: input.verifiedByUserId ?? null, updatedAt: now })
        .where(eq(paymentReceipts.id, receipt.id)),
      ...credits.map((credit) => creditUpdateQuery(database, credit, now)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "verifikasi struk bayar");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  const credit = credits.find((c) => c.orderId === input.orderId);
  const paidAmount = credit?.paidAmount ?? order.paidAmount;
  const paymentStatus = credit?.paymentStatus ?? order.paymentStatus;
  const due = credit?.due ?? dueOf(order);
  const updatedOrder = (await findOrder(database, input.kind, input.orderId)) ?? order;
  const payment = (await listPaymentsWithStatus(database, input.kind, input.orderId)).find((row) => row.id === receipt.id) ?? null;
  const allocationAmount = payment?.allocationAmount ?? 0;
  const notification =
    order.paymentStatus !== "paid" && paymentStatus === "paid"
      ? await notifyOrderPaidOff(
          database,
          { order: updatedOrder, student: await loadStudent(database, order.studentId), amount: allocationAmount, kind: input.kind },
          deps
        )
      : null;

  return {
    ok: true,
    data: {
      order: updatedOrder,
      payment,
      paymentStatus,
      paidAmount,
      remainingAmount: Math.max(0, due - paidAmount),
      notification,
    },
  };
};

export interface RejectPaymentInput {
  kind: PaymentKind;
  orderId: string;
  paymentId: string;
  reason: string;
  baseUrl?: string;
}

export interface RejectPaymentSuccess {
  ok: true;
  data: { order: OrderRow; payment: ListPaymentRow | null; confirmUrl: string; notification: NotifyResult };
}

/** Tolak satu struk: tandai (tanpa kredit) + kirim tautan unggah ulang. */
export const rejectPayment = async (
  database: AppDatabase,
  input: RejectPaymentInput,
  deps?: ReviewDeps
): Promise<RejectPaymentSuccess | PaymentReviewError> => {
  const now = writeNow(deps);
  const order = await findOrder(database, input.kind, input.orderId);
  if (!order) return notFound("Pesanan tidak ditemukan.");
  const receipt = await findReceipt(database, input.paymentId);
  if (!receipt) return notFound("Bukti pembayaran tidak ditemukan.");
  const allocations = await receiptAllocations(database, receipt.id);
  if (!allocations.some((a) => a.kind === input.kind && a.orderId === input.orderId)) {
    return notFound("Bukti pembayaran tidak ditemukan.");
  }
  const lifecycle = paymentRowStatus(receipt);
  if (lifecycle === "verified") return invalid("Bukti pembayaran ini sudah diverifikasi; tidak bisa ditolak.");
  if (lifecycle === "rejected") return invalid("Bukti pembayaran ini sudah ditolak sebelumnya.");
  const token = await ensurePaymentToken(database, orderTableFor(input.kind), order.id, order.paymentToken, deps);
  const confirmUrl = confirmUrlFor(input.baseUrl, input.kind, token);
  try {
    await runWriteBatch(database, [
      database
        .update(paymentReceipts)
        .set({ rejectedAt: now, rejectReason: input.reason, updatedAt: now })
        .where(eq(paymentReceipts.id, receipt.id)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "penolakan struk bayar");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  const payment = (await listPaymentsWithStatus(database, input.kind, input.orderId)).find((row) => row.id === receipt.id) ?? null;
  const notification = await notifyPaymentRejected(
    database,
    { order, student: await loadStudent(database, order.studentId), reason: input.reason, confirmUrl, kind: input.kind },
    deps
  );
  return { ok: true, data: { order, payment, confirmUrl, notification } };
};

export interface CashierPaymentInput {
  transferAmount: number;
  allocationAmount?: number;
  bookAllocationAmount?: number;
  bankName?: string;
  referenceNumber?: string;
  verifiedByUserId?: string | null;
  notes?: string;
}

export interface CashierPaymentSuccess {
  ok: true;
  data: { orderId: string; paymentStatus: string; paidAmount: number; remainingAmount: number };
}

/** Kasir manual (uang diterima langsung): struk auto-verified + kredit order. */
export const recordCashierPayment = async (
  database: AppDatabase,
  kind: PaymentKind,
  orderId: string,
  input: CashierPaymentInput,
  deps?: WriteDeps
): Promise<CashierPaymentSuccess | PaymentReviewError> => {
  const now = writeNow(deps);
  const order = await findOrder(database, kind, orderId);
  if (!order) return notFound("Pesanan tidak ditemukan.");
  const effectiveAllocation = input.allocationAmount ?? input.bookAllocationAmount ?? 0;
  if (effectiveAllocation < 1) return invalid("Nominal alokasi wajib diisi");
  const alreadyPaid = await verifiedAllocationSum(database, kind, orderId);
  const paidAmount = alreadyPaid + effectiveAllocation;
  const { due, paymentStatus } = creditParts(order, paidAmount);
  const receiptId = newWriteId(deps);
  const built = buildReceiptDraft(
    {
      studentId: order.studentId,
      schoolId: order.schoolId,
      amount: input.transferAmount,
      allocations: [{ orderId, kind, amount: effectiveAllocation, billAmount: due }],
      bankName: input.bankName,
      referenceNumber: input.referenceNumber,
      verifiedByUserId: input.verifiedByUserId ?? null,
      autoVerify: true,
      notes: input.notes,
    },
    now,
    receiptId
  );
  if (!built.ok) return { ok: false, status: built.status, message: built.message };
  // Kredit dihitung dari baris order yang sama sebelum batch; struk + kredit
  // ditulis atomik agar verifikasi tidak pernah meninggalkan order tak terkredit.
  const credit: Credit =
    kind === "buku"
      ? {
          kind,
          orderId,
          paidAmount,
          due,
          paymentStatus: paymentStatus as typeof studentBookOrders.$inferSelect["paymentStatus"],
        }
      : {
          kind,
          orderId,
          paidAmount,
          due,
          paymentStatus: paymentStatus as typeof uniformOrders.$inferSelect["paymentStatus"],
        };
  try {
    await runWriteBatch(database, [
      ...receiptWriteQueries(database, built.draft),
      creditUpdateQuery(database, credit, now),
    ]);
  } catch (err) {
    if (receiptNumberConflict(err)) {
      return {
        ok: false,
        status: 409,
        message: "Bukti transfer dengan bank + nomor referensi ini sudah pernah dicatat.",
      };
    }
    const mapped = d1WriteErrorStatus(err, "pembayaran kasir");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  return {
    ok: true,
    data: {
      orderId,
      paymentStatus,
      paidAmount,
      remainingAmount: Math.max(0, due - paidAmount),
    },
  };
};
