import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { paymentAllocations, paymentReceipts, studentBookOrders, uniformOrders } from "../../db/schema";
import { dueOf } from "../../lib/order-money";
import { allocationViolation } from "../../lib/order-allocation";
import { chunkRows } from "../lib/d1-write";

/**
 * Satu-satunya modul Struk Bayar + Alokasi: membentuk baris (kernel
 * `buildReceiptDraft`), membaca join per order, dan menurunkan kredit/status.
 * Uang masuk dicatat sekali per struk (identitas: bank + nomor referensi), lalu
 * dipecah ke beberapa order. `paidAmount` order diturunkan dari jumlah alokasi
 * terverifikasi, bukan ditambah bertahap — supaya angka tidak melenceng.
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
  /** Tagihan order (barang + ongkir) untuk plafon alokasi; default nominal struk. */
  billAmount?: number;
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

/**
 * Satu-satunya tempat menghitung due + status bayar dari angka. `paymentStatus`
 * sebelumnya dipertahankan saat beasiswa (deriveStatus = null), dan tipe aslinya
 * ikut terbawa agar buku/seragam tidak perlu cast.
 */
export const creditParts = <S extends string>(
  order: { orderType: string; totalAmount: number; shippingCost?: number | null; paymentStatus: S },
  paidAmount: number
): { due: number; paymentStatus: S | "unpaid" | "partial" | "paid" } => {
  const due = dueOf(order);
  return { due, paymentStatus: deriveStatus(order.orderType, paidAmount, due) ?? order.paymentStatus };
};

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
    const { due, paymentStatus } = creditParts(order, paidAmount);
    await database
      .update(studentBookOrders)
      .set({ paidAmount, paymentStatus, updatedAt: now })
      .where(eq(studentBookOrders.id, orderId));
    return { ok: true, kind: "buku", orderId, paidAmount, paymentStatus, due };
  }
  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  if (!order) return notFound("Pesanan tidak ditemukan.");
  const { due, paymentStatus } = creditParts(order, paidAmount);
  await database
    .update(uniformOrders)
    .set({ paidAmount, paymentStatus, updatedAt: now })
    .where(eq(uniformOrders.id, orderId));
  return { ok: true, kind: "seragam", orderId, paidAmount, paymentStatus, due };
};

export type ReceiptRow = typeof paymentReceipts.$inferInsert;
export type AllocationRow = typeof paymentAllocations.$inferInsert;

export interface ReceiptDraft {
  receiptId: string;
  receipt: ReceiptRow;
  allocations: AllocationRow[];
}

export interface ReceiptDraftOptions {
  /** Bentuk id alokasi pemanggil; default kanonik `<receiptId>-<kind>-<orderId>`. */
  allocationId?: (allocation: AllocationInput) => string;
}

/**
 * Satu-satunya pembentuk baris Struk Bayar + Alokasi (ADR-0012). Murni:
 * validasi nominal, dedupe, dan plafon alokasi tinggal di sini; penulisan
 * batch tetap milik pemanggil agar order + struk tetap atomik.
 */
export const buildReceiptDraft = (
  input: ReceiptInput,
  now: string,
  receiptId: string,
  options?: ReceiptDraftOptions
): { ok: true; draft: ReceiptDraft } | LedgerError => {
  if (!Number.isInteger(input.amount) || input.amount < 1) return invalid("Nominal struk wajib angka bulat >= 1.");
  if (input.allocations.length === 0) return invalid("Alokasi wajib diisi minimal satu order.");
  const seen = new Set<string>();
  for (const allocation of input.allocations) {
    if (!Number.isInteger(allocation.amount) || allocation.amount < 1) return invalid("Nominal alokasi wajib angka bulat >= 1.");
    const violation = allocationViolation({
      allocationAmount: allocation.amount,
      transferAmount: input.amount,
      billAmount: allocation.billAmount ?? input.amount,
    });
    if (violation === "above_bill") return invalid("Nominal alokasi melebihi total tagihan order.");
    if (violation === "above_receipt") return invalid("Total alokasi melebihi nominal struk.");
    const key = `${allocation.kind}:${allocation.orderId}`;
    if (seen.has(key)) return invalid("Satu order hanya boleh muncul sekali dalam satu struk.");
    seen.add(key);
  }
  const allocated = input.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (allocated > input.amount) return invalid("Total alokasi melebihi nominal struk.");

  return {
    ok: true,
    draft: {
      receiptId,
      receipt: {
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
      },
      allocations: input.allocations.map((allocation) => ({
        id: options?.allocationId?.(allocation) ?? `${receiptId}-${allocation.kind}-${allocation.orderId}`,
        receiptId,
        orderId: allocation.orderId,
        kind: allocation.kind,
        amount: allocation.amount,
        createdAt: now,
      })),
    },
  };
};

/**
 * Query insert kanonik untuk satu draft struk. Pemanggil menempelkannya ke
 * batch atomiknya sendiri (order + struk), jadi hanya modul ini yang merakit
 * pasangan tabel `payment_receipts`/`payment_allocations`.
 */
export const receiptWriteQueries = (database: AppDatabase, draft: ReceiptDraft) => [
  database.insert(paymentReceipts).values(draft.receipt),
  ...chunkRows(draft.allocations).map((rows) => database.insert(paymentAllocations).values(rows)),
];

/** Duplikat identitas struk (bank + nomor referensi) = 409, bukan 400 generik. */
export const receiptNumberConflict = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err);
  return /UNIQUE/i.test(message) && /payment_receipts/i.test(message);
};

/** Siklus hidup struk: rejected > verified > pending. Murni. */
export type PaymentRowStatus = "pending" | "verified" | "rejected";

export const paymentRowStatus = (payment: { verifiedAt: string | null; rejectedAt: string | null }): PaymentRowStatus =>
  payment.rejectedAt ? "rejected" : payment.verifiedAt ? "verified" : "pending";

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

/**
 * Satu-satunya pembaca Struk Bayar + Alokasi per order. Join ini dipakai
 * riwayat pembayaran dan tautan konfirmasi; dilarang disalin ke modul lain.
 */
export const listPaymentRows = async (
  database: AppDatabase,
  kind: PaymentKind,
  orderId: string
): Promise<ListPaymentRow[]> => {
  const rows = await database
    .select({
      id: paymentReceipts.id,
      orderId: paymentAllocations.orderId,
      allocationAmount: paymentAllocations.amount,
      transferAmount: paymentReceipts.amount,
      bankName: paymentReceipts.bankName,
      referenceNumber: paymentReceipts.referenceNumber,
      paymentProofUrl: paymentReceipts.proofUrl,
      verifiedAt: paymentReceipts.verifiedAt,
      rejectedAt: paymentReceipts.rejectedAt,
      rejectReason: paymentReceipts.rejectReason,
      notes: paymentReceipts.notes,
      createdAt: paymentReceipts.createdAt,
    })
    .from(paymentAllocations)
    .innerJoin(paymentReceipts, eq(paymentReceipts.id, paymentAllocations.receiptId))
    .where(and(eq(paymentAllocations.kind, kind), eq(paymentAllocations.orderId, orderId)))
    .orderBy(desc(paymentReceipts.createdAt));
  return rows.map((row) => ({ ...row, status: paymentRowStatus(row) }));
};
