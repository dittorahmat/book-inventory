import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { paymentAllocations, paymentReceipts, studentBookOrders, uniformOrders } from "../../db/schema";
import {
  chunkRows,
  d1WriteErrorStatus,
  runWriteBatch,
  writeNow,
  type WriteDeps,
} from "../lib/d1-write";
import { invoiceTotal } from "./order-invoice";

/**
 * Satu-satunya penulis Struk Bayar + Alokasi. Uang masuk dicatat sekali per
 * struk (identitas: bank + nomor referensi), lalu dipecah ke beberapa order.
 * `paidAmount` order diturunkan dari jumlah alokasi terverifikasi, bukan
 * ditambah bertahap — supaya angka tidak bisa melenceng dari barisnya.
 */

export type PaymentKind = "buku" | "seragam";

export type LedgerError = { ok: false; status: 400 | 404 | 409; message: string };

const invalid = (message: string): LedgerError => ({ ok: false, status: 400, message });
const notFound = (message: string): LedgerError => ({ ok: false, status: 404, message });

type BookStatus = typeof studentBookOrders.$inferSelect["paymentStatus"];
type UniformStatus = typeof uniformOrders.$inferSelect["paymentStatus"];

export interface AllocationInput {
  orderId: string;
  kind: PaymentKind;
  amount: number;
}

export interface ReceiptInput {
  studentId: string;
  schoolId: string;
  amount: number;
  allocations: AllocationInput[];
  bankName?: string | null;
  referenceNumber?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
  verifiedByUserId?: string | null;
  createdByUserId?: string | null;
  autoVerify?: boolean;
}

/** Kredit hasil hitung ulang satu order; bentuknya sama untuk buku dan seragam. */
export type OrderCredit =
  | { ok: true; kind: "buku"; orderId: string; paidAmount: number; paymentStatus: BookStatus; due: number }
  | { ok: true; kind: "seragam"; orderId: string; paidAmount: number; paymentStatus: UniformStatus; due: number };

export const orderTableFor = (kind: PaymentKind) => (kind === "buku" ? studentBookOrders : uniformOrders);

/** Status turunan dari angka, bukan dari state sebelumnya. Beasiswa tetap apa adanya. */
export const deriveStatus = (orderType: string, paid: number, due: number): "unpaid" | "partial" | "paid" | null =>
  orderType === "scholarship" ? null : paid <= 0 ? "unpaid" : paid >= due ? "paid" : "partial";

/** Jumlah alokasi terverifikasi untuk satu order — sumber kebenaran `paidAmount`. */
export const verifiedAllocationSum = async (
  database: AppDatabase,
  kind: PaymentKind,
  orderId: string
): Promise<number> => {
  const [row] = await database
    .select({ total: sql<number>`coalesce(sum(${paymentAllocations.amount}), 0)` })
    .from(paymentAllocations)
    .innerJoin(paymentReceipts, eq(paymentReceipts.id, paymentAllocations.receiptId))
    .where(
      and(
        eq(paymentAllocations.kind, kind),
        eq(paymentAllocations.orderId, orderId),
        isNotNull(paymentReceipts.verifiedAt),
        isNull(paymentReceipts.rejectedAt)
      )
    );
  return Number(row?.total ?? 0);
};

/**
 * Kredit order hasil hitung dari barisnya. Nilainya turunan, jadi penulisan
 * ulang selalu memulihkan angka — tidak ada riwayat inkremental yang bisa drift.
 */
export const recomputeOrderPayment = async (
  database: AppDatabase,
  kind: PaymentKind,
  orderId: string,
  now: string
): Promise<OrderCredit | LedgerError> => {
  const paidAmount = await verifiedAllocationSum(database, kind, orderId);
  if (kind === "buku") {
    const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
    if (!order) return notFound("Pesanan tidak ditemukan.");
    const due = invoiceTotal(order.totalAmount, order.shippingCost ?? 0);
    const paymentStatus = deriveStatus(order.orderType, paidAmount, due) ?? order.paymentStatus;
    await database
      .update(studentBookOrders)
      .set({ paidAmount, paymentStatus, updatedAt: now })
      .where(eq(studentBookOrders.id, orderId));
    return { ok: true, kind: "buku", orderId, paidAmount, paymentStatus, due };
  }
  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  if (!order) return notFound("Pesanan tidak ditemukan.");
  const due = invoiceTotal(order.totalAmount, order.shippingCost ?? 0);
  const paymentStatus = deriveStatus(order.orderType, paidAmount, due) ?? order.paymentStatus;
  await database
    .update(uniformOrders)
    .set({ paidAmount, paymentStatus, updatedAt: now })
    .where(eq(uniformOrders.id, orderId));
  return { ok: true, kind: "seragam", orderId, paidAmount, paymentStatus, due };
};

const receiptNumberConflict = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE/i.test(msg) && /payment_receipts/i.test(msg);
};

/** Catat satu struk + alokasinya secara atomik. */
export const recordReceipt = async (
  database: AppDatabase,
  input: ReceiptInput,
  deps?: WriteDeps
): Promise<{ ok: true; receiptId: string } | LedgerError> => {
  const now = writeNow(deps);
  const receiptId = deps?.generateId ? deps.generateId() : crypto.randomUUID();
  if (!Number.isInteger(input.amount) || input.amount < 1) return invalid("Nominal struk wajib angka bulat >= 1.");
  if (input.allocations.length === 0) return invalid("Alokasi wajib diisi minimal satu order.");

  const seen = new Set<string>();
  for (const allocation of input.allocations) {
    if (!Number.isInteger(allocation.amount) || allocation.amount < 1) return invalid("Nominal alokasi wajib angka bulat >= 1.");
    const key = `${allocation.kind}:${allocation.orderId}`;
    if (seen.has(key)) return invalid("Satu order hanya boleh muncul sekali dalam satu struk.");
    seen.add(key);
  }
  const allocated = input.allocations.reduce((sum, a) => sum + a.amount, 0);
  if (allocated > input.amount) return invalid("Total alokasi melebihi nominal struk.");

  const allocationRows = input.allocations.map((allocation) => ({
    id: `${receiptId}-${allocation.kind}-${allocation.orderId}`,
    receiptId,
    orderId: allocation.orderId,
    kind: allocation.kind,
    amount: allocation.amount,
    createdAt: now,
  }));

  try {
    await runWriteBatch(database, [
      database.insert(paymentReceipts).values({
        id: receiptId,
        studentId: input.studentId,
        schoolId: input.schoolId,
        amount: input.amount,
        bankName: input.bankName?.trim() || "Tanpa Bank",
        referenceNumber: input.referenceNumber?.trim() || null,
        proofUrl: input.proofUrl ?? null,
        receivedAt: now,
        verifiedByUserId: input.autoVerify ? input.verifiedByUserId ?? null : null,
        verifiedAt: input.autoVerify ? now : null,
        notes: input.notes ?? null,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: now,
        updatedAt: now,
      }),
      ...chunkRows(allocationRows).map((rows) => database.insert(paymentAllocations).values(rows)),
    ]);
  } catch (err) {
    if (receiptNumberConflict(err)) {
      return {
        ok: false,
        status: 409,
        message: "Bukti transfer dengan bank + nomor referensi ini sudah pernah dicatat.",
      };
    }
    const mapped = d1WriteErrorStatus(err, "pencatatan struk bayar");
    if (mapped) return { ok: false, status: 400, message: mapped.message };
    throw err;
  }
  return { ok: true, receiptId };
};
