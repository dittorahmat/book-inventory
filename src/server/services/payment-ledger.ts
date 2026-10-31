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
  /** Arah uang. Default "in" (pembayaran murid); refund wajib "out". */
  direction?: "in" | "out";
  bankName?: string | null;
  referenceNumber?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
  verifiedByUserId?: string | null;
  createdByUserId?: string | null;
  autoVerify?: boolean;
}

/** Kredit hasil hitung ulang satu order; bentuknya sama untuk buku dan seragam. */
export type OrderCredit = {
  kind: PaymentKind;
  orderId: string;
  paidAmount: number;
  /** Gabungan enum tabel order; nilai selalu berasal dari baris order itu sendiri. */
  paymentStatus: BookStatus | UniformStatus;
  due: number;
};

/** Kredit order yang berhasil dihitung ulang (atau alasan gagal). */
export type OrderCreditResult = ({ ok: true } & OrderCredit) | LedgerError;

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
        eq(paymentReceipts.direction, "in"),
        isNotNull(paymentReceipts.verifiedAt),
        isNull(paymentReceipts.rejectedAt)
      )
    );
  return Number(row?.total ?? 0);
};

/**
 * Bangun kredit dari baris order apa pun. Satu-satunya tempat status bayar
 * diturunkan sebelum ditulis, sehingga pemanggil tidak perlu tahu tabelnya.
 */
export const orderCreditFor = (
  kind: PaymentKind,
  order: {
    id: string;
    orderType: string;
    totalAmount: number;
    shippingCost?: number | null;
    paymentStatus: BookStatus | UniformStatus;
  },
  paidAmount: number
): OrderCredit => {
  const { due, paymentStatus } = creditParts(order, paidAmount);
  return { kind, orderId: order.id, paidAmount, due, paymentStatus };
};

/**
 * Query tulis kredit ke baris order. Satu-satunya pemilik pemetaan
 * kind → tabel order untuk penulisan `paidAmount`/`paymentStatus`.
 * Seragam memakai enum status yang lebih sempit; nilai yang ditulis selalu
 * berasal dari baris seragam itu sendiri (lihat `orderCreditFor`).
 */
export const orderCreditQuery = (database: AppDatabase, credit: OrderCredit, now: string) =>
  credit.kind === "buku"
    ? database
        .update(studentBookOrders)
        .set({ paidAmount: credit.paidAmount, paymentStatus: credit.paymentStatus, updatedAt: now })
        .where(eq(studentBookOrders.id, credit.orderId))
    : database
        .update(uniformOrders)
        .set({ paidAmount: credit.paidAmount, paymentStatus: credit.paymentStatus as UniformStatus, updatedAt: now })
        .where(eq(uniformOrders.id, credit.orderId));

/**
 * Kredit order hasil hitung dari barisnya. Nilainya turunan, jadi penulisan
 * ulang selalu memulihkan angka — tidak ada riwayat inkremental yang bisa drift.
 */
export const recomputeOrderPayment = async (
  database: AppDatabase,
  kind: PaymentKind,
  orderId: string,
  now: string
): Promise<OrderCreditResult> => {
  const paidAmount = await verifiedAllocationSum(database, kind, orderId);
  if (kind === "buku") {
    const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
    if (!order) return notFound("Pesanan tidak ditemukan.");
    const credit = orderCreditFor("buku", order, paidAmount);
    await orderCreditQuery(database, credit, now);
    return { ok: true, ...credit };
  }
  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  if (!order) return notFound("Pesanan tidak ditemukan.");
  const credit = orderCreditFor("seragam", order, paidAmount);
  await orderCreditQuery(database, credit, now);
  return { ok: true, ...credit };
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
        direction: input.direction ?? "in",
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
/**
 * Varian idempoten untuk seed demo: baris struk dipulihkan tanpa menghapus
 * struk lain. Tetap di modul ini supaya seed tidak merakit baris sendiri.
 */
export const upsertReceiptQueries = (database: AppDatabase, draft: ReceiptDraft) => [
  database
    .insert(paymentReceipts)
    .values(draft.receipt)
    .onConflictDoUpdate({
      target: paymentReceipts.id,
      set: {
        studentId: draft.receipt.studentId,
        schoolId: draft.receipt.schoolId,
        amount: draft.receipt.amount,
        direction: draft.receipt.direction,
        bankName: draft.receipt.bankName,
        referenceNumber: draft.receipt.referenceNumber,
        proofUrl: draft.receipt.proofUrl,
        receivedAt: draft.receipt.receivedAt,
        verifiedByUserId: draft.receipt.verifiedByUserId,
        verifiedAt: draft.receipt.verifiedAt,
        notes: draft.receipt.notes,
        createdByUserId: draft.receipt.createdByUserId,
        updatedAt: draft.receipt.updatedAt,
      },
    }),
  ...draft.allocations.map((allocation) =>
    database
      .insert(paymentAllocations)
      .values(allocation)
      .onConflictDoUpdate({
        target: paymentAllocations.id,
        set: {
          receiptId: allocation.receiptId,
          orderId: allocation.orderId,
          kind: allocation.kind,
          amount: allocation.amount,
        },
      })
  ),
];

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
    .where(
      and(
        eq(paymentAllocations.kind, kind),
        eq(paymentAllocations.orderId, orderId),
        eq(paymentReceipts.direction, "in")
      )
    )
    .orderBy(desc(paymentReceipts.createdAt));
  return rows.map((row) => ({ ...row, status: paymentRowStatus(row) }));
};
