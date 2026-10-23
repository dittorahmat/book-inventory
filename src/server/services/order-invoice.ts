import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  studentBookOrders,
  studentOrderItems,
  students,
  uniformOrderItems,
  uniformOrders,
} from "../../db/schema";
import { formatRupiah } from "../../lib/transfer-pricing";
import { invoiceTotal } from "../../lib/order-money";
import { decodeBase64ToBytes } from "../base64";
import { defaultStorage, type StorageService } from "../../services/storage";
import { d1WriteErrorStatus, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";
import { buildReceiptDraft, listPaymentRows, receiptNumberConflict, receiptWriteQueries, type PaymentKind } from "./payment-ledger";
import { MetaWhatsAppSender, type WhatsAppSender } from "./whatsapp";

export { invoiceTotal };

export type InvoiceError = { ok: false; status: 400 | 404 | 409; message: string };

const invalid = (message: string): InvoiceError => ({ ok: false, status: 400, message });

export const buildInvoiceText = (input: {
  studentName: string;
  orderNumber: string;
  bookTotal: number;
  shippingCost: number;
  confirmUrl: string;
}): string =>
  `Halo Bapak/Ibu, tagihan buku untuk ananda ${input.studentName} (${input.orderNumber}):\n` +
  `Tagihan buku: ${formatRupiah(input.bookTotal)}\n` +
  `Ongkir: ${formatRupiah(input.shippingCost)}\n` +
  `Total: ${formatRupiah(invoiceTotal(input.bookTotal, input.shippingCost))}\n\n` +
  `Konfirmasi pembayaran (lunas/bertahap) di link berikut:\n${input.confirmUrl}\n\nTerima kasih, Al Wildan Logistics`;

export interface SendInvoiceDeps extends WriteDeps {
  sender?: WhatsAppSender;
  baseUrl?: string;
}

const hasShippingInput = (shippingCost: number | null | undefined, shippingResi: string | null | undefined): boolean =>
  (shippingCost ?? 0) > 0 || !!shippingResi?.trim();

/** URL konfirmasi orang tua: `/bayar/<buku|seragam>/<token>` (tanpa slash ganda). */
export const confirmUrlFor = (baseUrl: string | undefined, kind: "buku" | "seragam", token: string): string =>
  `${(baseUrl ?? "").replace(/\/$/, "")}/bayar/${kind}/${token}`;

/** Pastikan order punya paymentToken; dipakai kirim invoice + penolakan bukti (unggah ulang lewat tautan sama). */
export const ensurePaymentToken = async (
  database: AppDatabase,
  table: typeof studentBookOrders | typeof uniformOrders,
  orderId: string,
  current: string | null,
  deps?: WriteDeps
): Promise<string> => {
  if (current) return current;
  const token = crypto.randomUUID();
  await database.update(table).set({ paymentToken: token, updatedAt: writeNow(deps) }).where(eq(table.id, orderId));
  return token;
};

type InvoiceOrderTable = typeof studentBookOrders | typeof uniformOrders;

interface InvoiceKind {
  notFound: string;
  confirmKind: "buku" | "seragam";
  errorContext: string;
  gateOnlyWhenLoose: boolean;
}

/** Perbedaan audit: pesan 404 + gerbang ongkir buku hanya untuk order satuan. */
const BOOK_INVOICE: InvoiceKind = {
  notFound: "Pesanan tidak ditemukan.",
  confirmKind: "buku",
  errorContext: "kirim invoice buku",
  gateOnlyWhenLoose: true,
};

const UNIFORM_INVOICE: InvoiceKind = {
  notFound: "Order seragam tidak ditemukan.",
  confirmKind: "seragam",
  errorContext: "kirim invoice seragam",
  gateOnlyWhenLoose: false,
};

/**
 * Satu-satunya inti kirim Invoice WhatsApp: token → gerbang ongkir →
 * tulis → notify. Kind hanya menyumbang pesan 404 + aturan gerbang.
 */
const sendInvoiceCore = async (
  database: AppDatabase,
  table: InvoiceOrderTable,
  orderId: string,
  kind: InvoiceKind,
  deps?: SendInvoiceDeps
): Promise<{ ok: true; data: { order: typeof studentBookOrders.$inferSelect | typeof uniformOrders.$inferSelect; confirmUrl: string; notification: unknown } } | InvoiceError> => {
  const now = writeNow(deps);
  const [order] = await database.select().from(table).where(eq(table.id, orderId));
  if (!order) return { ok: false, status: 404, message: kind.notFound };
  const needsGate = kind.gateOnlyWhenLoose
    ? (await database.select({ id: studentOrderItems.id }).from(studentOrderItems).where(eq(studentOrderItems.orderId, orderId)).limit(1)).length > 0
    : true;
  if (needsGate && !hasShippingInput(order.shippingCost, order.shippingResi)) return invalid("Input ongkir terlebih dahulu sebelum mengirim invoice.");
  const token = await ensurePaymentToken(database, table, orderId, order.paymentToken, deps);
  const confirmUrl = confirmUrlFor(deps?.baseUrl, kind.confirmKind, token);
  try {
    await database.update(table).set({ invoiceSentAt: now, updatedAt: now }).where(eq(table.id, orderId));
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, kind.errorContext);
    if (mapped) return { ok: false, ...mapped } as InvoiceError;
    throw err;
  }
  const [student] = await database.select().from(students).where(eq(students.id, order.studentId));
  const sender: WhatsAppSender = deps?.sender ?? new MetaWhatsAppSender(database);
  const notification = student?.parentPhone
    ? await sender.send({
        to: student.parentPhone,
        text: buildInvoiceText({
          studentName: student.name, orderNumber: order.orderNumber,
          bookTotal: order.totalAmount, shippingCost: order.shippingCost ?? 0, confirmUrl,
        }),
      })
    : { success: false, error: "Nomor WA orang tua tidak tersedia." };
  const [updated] = await database.select().from(table).where(eq(table.id, orderId));
  return { ok: true, data: { order: updated, confirmUrl, notification } };
};

export async function sendBookInvoice(
  database: AppDatabase,
  orderId: string,
  deps?: SendInvoiceDeps
): Promise<{ ok: true; data: { order: typeof studentBookOrders.$inferSelect; confirmUrl: string; notification: unknown } } | InvoiceError> {
  const res = await sendInvoiceCore(database, studentBookOrders, orderId, BOOK_INVOICE, deps);
  return res as { ok: true; data: { order: typeof studentBookOrders.$inferSelect; confirmUrl: string; notification: unknown } } | InvoiceError;
}

export async function sendUniformInvoice(
  database: AppDatabase,
  orderId: string,
  deps?: SendInvoiceDeps
): Promise<{ ok: true; data: { order: typeof uniformOrders.$inferSelect; confirmUrl: string; notification: unknown } } | InvoiceError> {
  const res = await sendInvoiceCore(database, uniformOrders, orderId, UNIFORM_INVOICE, deps);
  return res as { ok: true; data: { order: typeof uniformOrders.$inferSelect; confirmUrl: string; notification: unknown } } | InvoiceError;
}

export interface ConfirmPaymentInput {
  transferAmount: number;
  allocationAmount: number;
  bankName?: string;
  referenceNumber?: string;
  paymentProofBase64?: string;
}

export interface ConfirmDeps extends WriteDeps {
  storage?: StorageService;
}

const checkConfirmInput = (input: ConfirmPaymentInput): InvoiceError | null => {
  if (!Number.isInteger(input.transferAmount) || input.transferAmount < 1) return invalid("Nominal transfer minimal Rp 1.");
  if (!Number.isInteger(input.allocationAmount) || input.allocationAmount < 1) return invalid("Nominal alokasi minimal Rp 1.");
  if (input.allocationAmount > input.transferAmount) return invalid("Alokasi melebihi nominal transfer.");
  return null;
};

const uploadProof = async (storage: StorageService, prefix: string, orderId: string, base64: string | undefined): Promise<{ url: string | null; key: string | null }> => {
  if (!base64) return { url: null, key: null };
  const key = `${prefix}/${orderId}_${Date.now()}.jpg`;
  const url = await storage.upload(key, decodeBase64ToBytes(base64), "image/jpeg");
  return { url, key };
};

interface ConfirmKind {
  errorContext: string;
  proofPrefix: string;
  paymentKind: PaymentKind;
  notes: string;
}

const BOOK_CONFIRM: ConfirmKind = {
  errorContext: "konfirmasi pembayaran buku",
  proofPrefix: "payments",
  paymentKind: "buku",
  notes: "Konfirmasi via link pembayaran (menunggu verifikasi gudang)",
};
const UNIFORM_CONFIRM: ConfirmKind = {
  errorContext: "konfirmasi pembayaran seragam",
  proofPrefix: "uniform-payments",
  paymentKind: "seragam",
  notes: "Konfirmasi via link pembayaran (menunggu verifikasi gudang)",
};

/**
 * Satu-satunya inti klaim pembayaran orang tua: validasi → bukti → catat
 * baris pembayaran PENDING saja. Klaim TIDAK menyentuh paidAmount/paymentStatus
 * order — uang baru sah setelah staf gudang memverifikasi (lihat
 * `order-payment-review`). Status order yang dikembalikan = status saat ini
 * (tak berubah). Kind hanya menyumbang prefix bukti + jenis alokasi.
 */
const confirmPaymentCore = async (
  database: AppDatabase,
  table: InvoiceOrderTable,
  token: string,
  input: ConfirmPaymentInput,
  kind: ConfirmKind,
  deps?: ConfirmDeps
): Promise<{ ok: true; data: { paymentStatus: string; paidAmount: number } } | InvoiceError> => {
  const bad = checkConfirmInput(input);
  if (bad) return bad;
  const now = writeNow(deps);
  const storage = deps?.storage ?? defaultStorage;
  const [order] = await database.select().from(table).where(eq(table.paymentToken, token));
  if (!order) return { ok: false, status: 404, message: "Link konfirmasi tidak valid." };
  if (order.paymentStatus === "paid") {
    return invalid("Pesanan ini sudah lunas diverifikasi gudang. Pengajuan bukti baru tidak diperlukan.");
  }
  const due = invoiceTotal(order.totalAmount, order.shippingCost ?? 0);
  const { url, key } = await uploadProof(storage, kind.proofPrefix, order.id, input.paymentProofBase64);
  const receiptId = crypto.randomUUID();
  const built = buildReceiptDraft(
    {
      studentId: order.studentId,
      schoolId: order.schoolId,
      amount: input.transferAmount,
      allocations: [
        { orderId: order.id, kind: kind.paymentKind, amount: input.allocationAmount, billAmount: due },
      ],
      bankName: input.bankName,
      referenceNumber: input.referenceNumber,
      proofUrl: url,
      notes: kind.notes,
    },
    now,
    receiptId,
    { allocationId: (allocation) => `${receiptId}-${allocation.kind}` }
  );
  if (!built.ok) return built;
  try {
    await runWriteBatch(database, receiptWriteQueries(database, built.draft));
    return { ok: true, data: { paymentStatus: order.paymentStatus, paidAmount: order.paidAmount } };
  } catch (err) {
    if (key) { try { await storage.delete(key); } catch { /* best-effort */ } }
    if (receiptNumberConflict(err)) {
      return { ok: false, status: 409, message: "Bukti transfer dengan bank + nomor referensi ini sudah pernah dicatat." };
    }
    const mapped = d1WriteErrorStatus(err, kind.errorContext);
    if (mapped) return { ok: false, ...mapped } as InvoiceError;
    throw err;
  }
};

export async function confirmBookPayment(
  database: AppDatabase,
  token: string,
  input: ConfirmPaymentInput,
  deps?: ConfirmDeps
): Promise<{ ok: true; data: { paymentStatus: string; paidAmount: number } } | InvoiceError> {
  return confirmPaymentCore(database, studentBookOrders, token, input, BOOK_CONFIRM, deps);
}

export async function confirmUniformPayment(
  database: AppDatabase,
  token: string,
  input: ConfirmPaymentInput,
  deps?: ConfirmDeps
): Promise<{ ok: true; data: { paymentStatus: string; paidAmount: number } } | InvoiceError> {
  return confirmPaymentCore(database, uniformOrders, token, input, UNIFORM_CONFIRM, deps);
}

/** Struk + porsi alokasi yang menyentuh satu order (terbaru lebih dulu). */
export async function lookupBookByToken(database: AppDatabase, token: string) {
  const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.paymentToken, token));
  if (!order) return null;
  const [student] = await database.select().from(students).where(eq(students.id, order.studentId));
  const lines = await database.select().from(studentOrderItems).where(eq(studentOrderItems.orderId, order.id));
  const payments = await listPaymentRows(database, "buku", order.id);
  return { order, student, lines, payments, due: invoiceTotal(order.totalAmount, order.shippingCost ?? 0) };
}

export async function lookupUniformByToken(database: AppDatabase, token: string) {
  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.paymentToken, token));
  if (!order) return null;
  const [student] = await database.select().from(students).where(eq(students.id, order.studentId));
  const lines = await database.select().from(uniformOrderItems).where(eq(uniformOrderItems.orderId, order.id));
  const payments = await listPaymentRows(database, "seragam", order.id);
  return { order, student, lines, payments, due: invoiceTotal(order.totalAmount, order.shippingCost ?? 0) };
}
