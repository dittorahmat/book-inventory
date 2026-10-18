import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppDatabase } from "../../db";
import { paymentAllocations, paymentReceipts, studentBookOrders, students, uniformOrders } from "../../db/schema";
import { d1WriteErrorStatus, runWriteBatch, selectInChunks, writeNow, type WriteDeps } from "../lib/d1-write";
import { confirmUrlFor, ensurePaymentToken } from "./order-invoice";
import { notifyOrderPaidOff, notifyPaymentRejected, type NotifyDeps, type NotifyResult } from "./order-paid-notify";
import {
  orderTableFor,
  recomputeOrderPayment,
  recordReceipt,
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

export const cashierPaymentSchema = z.object({
  transferAmount: z.number().int().min(1, "Nominal transfer wajib diisi"),
  allocationAmount: z.number().int().min(1, "Nominal alokasi wajib diisi"),
  bankName: z.string().optional(),
  referenceNumber: z.string().optional(),
  verifiedByUserId: z.string().optional(),
  notes: z.string().optional(),
});

export type PaymentRowStatus = "pending" | "verified" | "rejected";

type OrderRow = typeof studentBookOrders.$inferSelect | typeof uniformOrders.$inferSelect;

export type PaymentReviewError = { ok: false; status: 400 | 404 | 409; message: string };
export interface ReviewDeps extends WriteDeps, NotifyDeps {}

const invalid = (message: string): PaymentReviewError => ({ ok: false, status: 400, message });
const notFound = (message: string): PaymentReviewError => ({ ok: false, status: 404, message });

/** Siklus hidup struk: rejected > verified > pending. Murni. */
export const paymentRowStatus = (p: { verifiedAt: string | null; rejectedAt: string | null }): PaymentRowStatus =>
  p.rejectedAt ? "rejected" : p.verifiedAt ? "verified" : "pending";

/** Baris review: satu alokasi + struk induknya. */
export interface ListPaymentRow {
  id: string;
  orderId: string;
  transferAmount: number;
  allocationAmount: number;
  bankName: string | null;
  referenceNumber: string | null;
  paymentProofUrl: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  notes: string | null;
  createdAt: string;
  status: PaymentRowStatus;
}

const receiptColumns = {
  id: paymentReceipts.id,
  transferAmount: paymentReceipts.amount,
  bankName: paymentReceipts.bankName,
  referenceNumber: paymentReceipts.referenceNumber,
  paymentProofUrl: paymentReceipts.proofUrl,
  verifiedAt: paymentReceipts.verifiedAt,
  rejectedAt: paymentReceipts.rejectedAt,
  rejectReason: paymentReceipts.rejectReason,
  notes: paymentReceipts.notes,
  createdAt: paymentReceipts.createdAt,
};

const listForOrder = async (database: AppDatabase, kind: PaymentKind, orderId: string): Promise<ListPaymentRow[]> => {
  const rows = await database
    .select({ ...receiptColumns, orderId: paymentAllocations.orderId, allocationAmount: paymentAllocations.amount })
    .from(paymentAllocations)
    .innerJoin(paymentReceipts, eq(paymentReceipts.id, paymentAllocations.receiptId))
    .where(and(eq(paymentAllocations.kind, kind), eq(paymentAllocations.orderId, orderId)))
    .orderBy(desc(paymentReceipts.createdAt));
  return rows.map((row) => ({ ...row, status: paymentRowStatus(row) }));
};

export const listPaymentsWithStatus = async (
  database: AppDatabase,
  kind: PaymentKind,
  orderId: string
): Promise<ListPaymentRow[]> => listForOrder(database, kind, orderId);

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

  try {
    await runWriteBatch(database, [
      database
        .update(paymentReceipts)
        .set({ verifiedAt: now, verifiedByUserId: input.verifiedByUserId ?? null, updatedAt: now })
        .where(eq(paymentReceipts.id, receipt.id)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "verifikasi struk bayar");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  const credits = [];
  for (const allocation of allocations) {
    credits.push(await recomputeOrderPayment(database, allocation.kind, allocation.orderId, now));
  }
  const credit = credits.find((c) => c.ok && c.orderId === input.orderId);
  const paidAmount = credit && credit.ok ? credit.paidAmount : order.paidAmount;
  const paymentStatus = credit && credit.ok ? credit.paymentStatus : order.paymentStatus;
  const due = credit && credit.ok ? credit.due : order.totalAmount + (order.shippingCost ?? 0);
  const updatedOrder = (await findOrder(database, input.kind, input.orderId)) ?? order;
  const payment = (await listForOrder(database, input.kind, input.orderId)).find((row) => row.id === receipt.id) ?? null;
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
  const payment = (await listForOrder(database, input.kind, input.orderId)).find((row) => row.id === receipt.id) ?? null;
  const notification = await notifyPaymentRejected(
    database,
    { order, student: await loadStudent(database, order.studentId), reason: input.reason, confirmUrl, kind: input.kind },
    deps
  );
  return { ok: true, data: { order, payment, confirmUrl, notification } };
};

export interface CashierPaymentInput {
  transferAmount: number;
  allocationAmount: number;
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
  const receipt = await recordReceipt(
    database,
    {
      studentId: order.studentId,
      schoolId: order.schoolId,
      amount: Math.max(input.transferAmount, input.allocationAmount),
      allocations: [{ orderId, kind, amount: input.allocationAmount }],
      bankName: input.bankName,
      referenceNumber: input.referenceNumber,
      verifiedByUserId: input.verifiedByUserId ?? null,
      autoVerify: true,
      notes: input.notes,
    },
    deps
  );
  if (!receipt.ok) return { ok: false, status: receipt.status, message: receipt.message };
  const credit = await recomputeOrderPayment(database, kind, orderId, now);
  if (!credit.ok) return { ok: false, status: credit.status, message: credit.message };
  return {
    ok: true,
    data: {
      orderId,
      paymentStatus: credit.paymentStatus,
      paidAmount: credit.paidAmount,
      remainingAmount: Math.max(0, credit.due - credit.paidAmount),
    },
  };
};
