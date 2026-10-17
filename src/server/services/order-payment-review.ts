import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppDatabase } from "../../db";
import {
  orderPayments,
  studentBookOrders,
  students,
  uniformOrders,
  uniformPayments,
} from "../../db/schema";
import {
  d1WriteErrorStatus,
  runWriteBatch,
  selectInChunks,
  writeNow,
  type WriteDeps,
} from "../lib/d1-write";
import { confirmUrlFor, ensurePaymentToken, invoiceTotal } from "./order-invoice";
import {
  notifyOrderPaidOff,
  notifyPaymentRejected,
  type NotifyDeps,
  type NotifyResult,
  type NotifyStudent,
} from "./order-paid-notify";

/**
 * Satu-satunya inti review bukti transfer gudang (buku | seragam):
 * verifikasi menambah paidAmount order, penolakan menandai baris tanpa
 * mengkredit. Adapter per-kind hanya menyumbang tabel + tulis konkret;
 * aturan status dan notifikasi identik. Semua multi-tulis lewat
 * `runWriteBatch` (§10); error D1 dipetakan ke 4xx.
 */

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

export type PaymentKind = "buku" | "seragam";
export type PaymentRowStatus = "pending" | "verified" | "rejected";

type OrderRow = typeof studentBookOrders.$inferSelect | typeof uniformOrders.$inferSelect;
type PaymentRow = typeof orderPayments.$inferSelect | typeof uniformPayments.$inferSelect;
type CashierOrderTable = typeof studentBookOrders | typeof uniformOrders;
type CashierPaymentTable = typeof orderPayments | typeof uniformPayments;

type PaymentStatusValue =
  | "unpaid"
  | "partial"
  | "paid"
  | "scholarship_pending"
  | "scholarship_approved"
  | "scholarship_rejected";

type UniformPaymentStatus = "unpaid" | "partial" | "paid" | "scholarship_pending";

export type PaymentReviewError = { ok: false; status: 400 | 404; message: string };
export interface ReviewDeps extends WriteDeps, NotifyDeps {}

const invalid = (message: string): PaymentReviewError => ({ ok: false, status: 400, message });
const notFound = (message: string): PaymentReviewError => ({ ok: false, status: 404, message });

/** Siklus hidup baris: rejected > verified > pending. Murni. */
export const paymentRowStatus = (p: { verifiedAt: string | null; rejectedAt: string | null }): PaymentRowStatus =>
  p.rejectedAt ? "rejected" : p.verifiedAt ? "verified" : "pending";

/** Alokasi ke order (nama kolom beda antar kind); memakai penyempitan `in`. */
export const allocationOf = (payment: PaymentRow): number =>
  "bookAllocationAmount" in payment ? payment.bookAllocationAmount : payment.uniformAllocationAmount;

export interface CashierPaymentInput {
  transferAmount: number;
  allocationAmount: number;
  bankName?: string;
  referenceNumber?: string;
  verifiedByUserId?: string | null;
  notes?: string;
}

interface CashierRow {
  id: string;
  orderId: string;
  transferAmount: number;
  allocationAmount: number;
  bankName: string | null;
  referenceNumber: string | null;
  verifiedByUserId: string | null;
  notes: string | null;
  now: string;
}

interface PaymentKindAdapter {
  orderTable: CashierOrderTable;
  paymentTable: CashierPaymentTable;
  errorContext: string;
  markVerified: (database: AppDatabase, paymentId: string, now: string, userId: string | null) => unknown;
  markRejected: (database: AppDatabase, paymentId: string, now: string, reason: string) => unknown;
  creditOrder: (database: AppDatabase, orderId: string, paid: number, status: PaymentStatusValue, now: string) => unknown;
  insertCashierPayment: (database: AppDatabase, row: CashierRow) => unknown;
}

const BOOK_REVIEW: PaymentKindAdapter = {
  orderTable: studentBookOrders,
  paymentTable: orderPayments,
  errorContext: "review pembayaran buku",
  markVerified: (database, paymentId, now, userId) =>
    database.update(orderPayments).set({ verifiedAt: now, verifiedByUserId: userId }).where(eq(orderPayments.id, paymentId)),
  markRejected: (database, paymentId, now, reason) =>
    database.update(orderPayments).set({ rejectedAt: now, rejectReason: reason }).where(eq(orderPayments.id, paymentId)),
  creditOrder: (database, orderId, paid, status, now) =>
    database.update(studentBookOrders).set({ paidAmount: paid, paymentStatus: status, updatedAt: now }).where(eq(studentBookOrders.id, orderId)),
  insertCashierPayment: (database, row) =>
    database.insert(orderPayments).values({
      id: row.id,
      orderId: row.orderId,
      transferAmount: row.transferAmount,
      bookAllocationAmount: row.allocationAmount,
      bankName: row.bankName,
      referenceNumber: row.referenceNumber,
      verifiedByUserId: row.verifiedByUserId,
      verifiedAt: row.now,
      notes: row.notes,
      createdAt: row.now,
    }),
};

const UNIFORM_REVIEW: PaymentKindAdapter = {
  orderTable: uniformOrders,
  paymentTable: uniformPayments,
  errorContext: "review pembayaran seragam",
  markVerified: (database, paymentId, now, userId) =>
    database.update(uniformPayments).set({ verifiedAt: now, verifiedByUserId: userId }).where(eq(uniformPayments.id, paymentId)),
  markRejected: (database, paymentId, now, reason) =>
    database.update(uniformPayments).set({ rejectedAt: now, rejectReason: reason }).where(eq(uniformPayments.id, paymentId)),
  creditOrder: (database, orderId, paid, status, now) =>
    database.update(uniformOrders).set({ paidAmount: paid, paymentStatus: status as UniformPaymentStatus, updatedAt: now }).where(eq(uniformOrders.id, orderId)),
  insertCashierPayment: (database, row) =>
    database.insert(uniformPayments).values({
      id: row.id,
      orderId: row.orderId,
      transferAmount: row.transferAmount,
      uniformAllocationAmount: row.allocationAmount,
      bankName: row.bankName,
      referenceNumber: row.referenceNumber,
      verifiedByUserId: row.verifiedByUserId,
      verifiedAt: row.now,
      notes: row.notes,
      createdAt: row.now,
    }),
};

const adapterFor = (kind: PaymentKind): PaymentKindAdapter => (kind === "buku" ? BOOK_REVIEW : UNIFORM_REVIEW);

/** Status order berikutnya setelah kredit: beasiswa tetap status beasiswanya. */
const nextPaymentStatus = (order: OrderRow, paid: number, due: number): PaymentStatusValue =>
  order.orderType === "scholarship" ? order.paymentStatus : paid >= due ? "paid" : "partial";

const findOrder = async (database: AppDatabase, adapter: PaymentKindAdapter, orderId: string): Promise<OrderRow | undefined> => {
  const [order] = await database.select().from(adapter.orderTable).where(eq(adapter.orderTable.id, orderId));
  return order;
};

const findPayment = async (database: AppDatabase, adapter: PaymentKindAdapter, paymentId: string): Promise<PaymentRow | undefined> => {
  const [payment] = await database.select().from(adapter.paymentTable).where(eq(adapter.paymentTable.id, paymentId));
  return payment;
};

const loadStudent = async (database: AppDatabase, studentId: string): Promise<NotifyStudent> => {
  const [student] = await database.select().from(students).where(eq(students.id, studentId));
  return student ?? { name: "Ananda", parentPhone: null, parentEmail: null };
};

export type ListPaymentRow = PaymentRow & { status: PaymentRowStatus };

/** Baris pembayaran satu order + status siklus hidupnya (urut terbaru). */
export const listPaymentsWithStatus = async (
  database: AppDatabase,
  kind: PaymentKind,
  orderId: string
): Promise<ListPaymentRow[]> => {
  const table = adapterFor(kind).paymentTable;
  const rows = await database.select().from(table).where(eq(table.orderId, orderId)).orderBy(desc(table.createdAt));
  return rows.map((p: PaymentRow): ListPaymentRow => ({ ...p, status: paymentRowStatus(p) }));
};

/** Hitung klaim pending per order dalam satu grup-baca (bukan N+1). */
export const pendingPaymentCounts = async (
  database: AppDatabase,
  kind: PaymentKind,
  orderIds: string[]
): Promise<Map<string, number>> => {
  if (orderIds.length === 0) return new Map();
  const table = adapterFor(kind).paymentTable;
  const rows = await selectInChunks<{ orderId: string; count: number }>(orderIds, (chunk) =>
    database
      .select({ orderId: table.orderId, count: sql<number>`count(*)` })
      .from(table)
      .where(and(inArray(table.orderId, chunk), isNull(table.verifiedAt), isNull(table.rejectedAt)))
      .groupBy(table.orderId)
  );
  return new Map(rows.map((r) => [r.orderId, Number(r.count)]));
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
    payment: PaymentRow;
    paymentStatus: string;
    paidAmount: number;
    remainingAmount: number;
    notification: NotifyResult | null;
  };
}

/** Verifikasi satu klaim pending: kredit order + tandai baris, lalu notifikasi bila lunas. */
export const verifyPayment = async (
  database: AppDatabase,
  input: VerifyPaymentInput,
  deps?: ReviewDeps
): Promise<VerifyPaymentSuccess | PaymentReviewError> => {
  const now = writeNow(deps);
  const adapter = adapterFor(input.kind);
  const order = await findOrder(database, adapter, input.orderId);
  if (!order) return notFound("Pesanan tidak ditemukan.");
  const payment = await findPayment(database, adapter, input.paymentId);
  if (!payment || payment.orderId !== input.orderId) return notFound("Bukti pembayaran tidak ditemukan.");
  const lifecycle = paymentRowStatus(payment);
  if (lifecycle === "verified") return invalid("Bukti pembayaran ini sudah diverifikasi sebelumnya.");
  if (lifecycle === "rejected") return invalid("Bukti pembayaran ini sudah ditolak. Minta orang tua mengunggah ulang.");
  const allocation = allocationOf(payment);
  const due = invoiceTotal(order.totalAmount, order.shippingCost ?? 0);
  const paidAmount = order.paidAmount + allocation;
  const paymentStatus = nextPaymentStatus(order, paidAmount, due);
  try {
    await runWriteBatch(database, [
      adapter.markVerified(database, input.paymentId, now, input.verifiedByUserId ?? null),
      adapter.creditOrder(database, input.orderId, paidAmount, paymentStatus, now),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, adapter.errorContext);
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  const updatedOrder = (await findOrder(database, adapter, input.orderId)) ?? order;
  const updatedPayment = (await findPayment(database, adapter, input.paymentId)) ?? payment;
  const notification =
    order.paymentStatus !== "paid" && paymentStatus === "paid"
      ? await notifyOrderPaidOff(
          database,
          { order: updatedOrder, student: await loadStudent(database, order.studentId), amount: allocation, kind: input.kind },
          deps
        )
      : null;
  return {
    ok: true,
    data: {
      order: updatedOrder,
      payment: updatedPayment,
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
  data: { order: OrderRow; payment: PaymentRow; confirmUrl: string; notification: NotifyResult };
}

/** Tolak klaim pending: tandai baris (tanpa kredit) + kirim tautan unggah ulang. */
export const rejectPayment = async (
  database: AppDatabase,
  input: RejectPaymentInput,
  deps?: ReviewDeps
): Promise<RejectPaymentSuccess | PaymentReviewError> => {
  const now = writeNow(deps);
  const adapter = adapterFor(input.kind);
  const order = await findOrder(database, adapter, input.orderId);
  if (!order) return notFound("Pesanan tidak ditemukan.");
  const payment = await findPayment(database, adapter, input.paymentId);
  if (!payment || payment.orderId !== input.orderId) return notFound("Bukti pembayaran tidak ditemukan.");
  const lifecycle = paymentRowStatus(payment);
  if (lifecycle === "verified") return invalid("Bukti pembayaran ini sudah diverifikasi; tidak bisa ditolak.");
  if (lifecycle === "rejected") return invalid("Bukti pembayaran ini sudah ditolak sebelumnya.");
  const token = await ensurePaymentToken(database, adapter.orderTable, order.id, order.paymentToken, deps);
  const confirmUrl = confirmUrlFor(input.baseUrl, input.kind, token);
  try {
    await runWriteBatch(database, [adapter.markRejected(database, input.paymentId, now, input.reason)]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, adapter.errorContext);
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  const updatedPayment = (await findPayment(database, adapter, input.paymentId)) ?? payment;
  const notification = await notifyPaymentRejected(
    database,
    { order, student: await loadStudent(database, order.studentId), reason: input.reason, confirmUrl, kind: input.kind },
    deps
  );
  return { ok: true, data: { order, payment: updatedPayment, confirmUrl, notification } };
};

export interface CashierPaymentSuccess {
  ok: true;
  data: { orderId: string; paymentStatus: string; paidAmount: number; remainingAmount: number };
}

/** Kasir manual (uang diterima langsung): baris pembayaran auto-verified + kredit order. */
export const recordCashierPayment = async (
  database: AppDatabase,
  kind: PaymentKind,
  orderId: string,
  input: CashierPaymentInput,
  deps?: WriteDeps
): Promise<CashierPaymentSuccess | PaymentReviewError> => {
  const now = writeNow(deps);
  const adapter = adapterFor(kind);
  const order = await findOrder(database, adapter, orderId);
  if (!order) return notFound("Pesanan tidak ditemukan.");
  const due = invoiceTotal(order.totalAmount, order.shippingCost ?? 0);
  const paidAmount = order.paidAmount + input.allocationAmount;
  const paymentStatus = nextPaymentStatus(order, paidAmount, due);
  const paymentId = (deps?.generateId ?? (() => crypto.randomUUID()))();
  try {
    await runWriteBatch(database, [
      adapter.insertCashierPayment(database, {
        id: paymentId,
        orderId,
        transferAmount: input.transferAmount,
        allocationAmount: input.allocationAmount,
        bankName: input.bankName || "Cash/Manual Transfer",
        referenceNumber: input.referenceNumber || null,
        verifiedByUserId: input.verifiedByUserId ?? null,
        notes: input.notes || null,
        now,
      }),
      adapter.creditOrder(database, orderId, paidAmount, paymentStatus, now),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, adapter.errorContext);
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  return {
    ok: true,
    data: { orderId, paymentStatus, paidAmount, remainingAmount: Math.max(0, due - paidAmount) },
  };
};
