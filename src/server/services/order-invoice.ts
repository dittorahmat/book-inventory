import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  orderPayments,
  studentBookOrders,
  studentOrderItems,
  students,
  uniformOrderItems,
  uniformOrders,
  uniformPayments,
} from "../../db/schema";
import { formatRupiah } from "../../lib/transfer-pricing";
import { decodeBase64ToBytes } from "../base64";
import { defaultStorage, type StorageService } from "../../services/storage";
import { d1WriteErrorStatus, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";
import { MetaWhatsAppSender, type WhatsAppSender } from "./whatsapp";

export type InvoiceError = { ok: false; status: 400 | 404; message: string };

const invalid = (message: string): InvoiceError => ({ ok: false, status: 400, message });

export const invoiceTotal = (totalAmount: number, shippingCost: number): number => totalAmount + shippingCost;

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

const confirmUrlFor = (baseUrl: string | undefined, kind: "buku" | "seragam", token: string): string =>
  `${(baseUrl ?? "").replace(/\/$/, "")}/bayar/${kind}/${token}`;

const ensureToken = async (
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

export async function sendBookInvoice(
  database: AppDatabase,
  orderId: string,
  deps?: SendInvoiceDeps
): Promise<{ ok: true; data: { order: typeof studentBookOrders.$inferSelect; confirmUrl: string; notification: unknown } } | InvoiceError> {
  const now = writeNow(deps);
  const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  if (!order) return { ok: false, status: 404, message: "Pesanan tidak ditemukan." };
  const loose = await database.select({ id: studentOrderItems.id }).from(studentOrderItems).where(eq(studentOrderItems.orderId, orderId)).limit(1);
  if (loose.length > 0 && !hasShippingInput(order.shippingCost, order.shippingResi)) return invalid("Input ongkir terlebih dahulu sebelum mengirim invoice.");
  const token = await ensureToken(database, studentBookOrders, orderId, order.paymentToken, deps);
  const confirmUrl = confirmUrlFor(deps?.baseUrl, "buku", token);
  try {
    await database.update(studentBookOrders).set({ invoiceSentAt: now, updatedAt: now }).where(eq(studentBookOrders.id, orderId));
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "kirim invoice buku");
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
  const [updated] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  return { ok: true, data: { order: updated, confirmUrl, notification } };
}

export async function sendUniformInvoice(
  database: AppDatabase,
  orderId: string,
  deps?: SendInvoiceDeps
): Promise<{ ok: true; data: { order: typeof uniformOrders.$inferSelect; confirmUrl: string; notification: unknown } } | InvoiceError> {
  const now = writeNow(deps);
  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  if (!order) return { ok: false, status: 404, message: "Order seragam tidak ditemukan." };
  if (!hasShippingInput(order.shippingCost, order.shippingResi)) return invalid("Input ongkir terlebih dahulu sebelum mengirim invoice.");
  const token = await ensureToken(database, uniformOrders, orderId, order.paymentToken, deps);
  const confirmUrl = confirmUrlFor(deps?.baseUrl, "seragam", token);
  try {
    await database.update(uniformOrders).set({ invoiceSentAt: now, updatedAt: now }).where(eq(uniformOrders.id, orderId));
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "kirim invoice seragam");
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
  const [updated] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  return { ok: true, data: { order: updated, confirmUrl, notification } };
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

export async function confirmBookPayment(
  database: AppDatabase,
  token: string,
  input: ConfirmPaymentInput,
  deps?: ConfirmDeps
): Promise<{ ok: true; data: { paymentStatus: string; paidAmount: number } } | InvoiceError> {
  const bad = checkConfirmInput(input);
  if (bad) return bad;
  const now = writeNow(deps);
  const storage = deps?.storage ?? defaultStorage;
  const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.paymentToken, token));
  if (!order) return { ok: false, status: 404, message: "Link konfirmasi tidak valid." };
  const { url, key } = await uploadProof(storage, "payments", order.id, input.paymentProofBase64);
  try {
    const paidAmount = order.paidAmount + input.allocationAmount;
    const due = invoiceTotal(order.totalAmount, order.shippingCost ?? 0);
    const paymentStatus = order.orderType === "scholarship" ? order.paymentStatus : paidAmount >= due ? "paid" : "partial";
    await runWriteBatch(database, [
      database.insert(orderPayments).values({
        id: crypto.randomUUID(), orderId: order.id,
        transferAmount: input.transferAmount, bookAllocationAmount: input.allocationAmount,
        paymentProofUrl: url, bankName: input.bankName || null, referenceNumber: input.referenceNumber || null,
        notes: "Konfirmasi via link pembayaran", createdAt: now,
      }),
      database.update(studentBookOrders).set({ paidAmount, paymentStatus: paymentStatus as typeof order.paymentStatus, updatedAt: now }).where(eq(studentBookOrders.id, order.id)),
    ]);
    return { ok: true, data: { paymentStatus, paidAmount } };
  } catch (err) {
    if (key) { try { await storage.delete(key); } catch { /* best-effort */ } }
    const mapped = d1WriteErrorStatus(err, "konfirmasi pembayaran buku");
    if (mapped) return { ok: false, ...mapped } as InvoiceError;
    throw err;
  }
}

export async function confirmUniformPayment(
  database: AppDatabase,
  token: string,
  input: ConfirmPaymentInput,
  deps?: ConfirmDeps
): Promise<{ ok: true; data: { paymentStatus: string; paidAmount: number } } | InvoiceError> {
  const bad = checkConfirmInput(input);
  if (bad) return bad;
  const now = writeNow(deps);
  const storage = deps?.storage ?? defaultStorage;
  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.paymentToken, token));
  if (!order) return { ok: false, status: 404, message: "Link konfirmasi tidak valid." };
  const { url, key } = await uploadProof(storage, "uniform-payments", order.id, input.paymentProofBase64);
  try {
    const paidAmount = order.paidAmount + input.allocationAmount;
    const due = invoiceTotal(order.totalAmount, order.shippingCost ?? 0);
    const paymentStatus = paidAmount >= due ? "paid" : "partial";
    await runWriteBatch(database, [
      database.insert(uniformPayments).values({
        id: crypto.randomUUID(), orderId: order.id,
        transferAmount: input.transferAmount, uniformAllocationAmount: input.allocationAmount,
        paymentProofUrl: url, bankName: input.bankName || null, referenceNumber: input.referenceNumber || null,
        notes: "Konfirmasi via link pembayaran", createdAt: now,
      }),
      database.update(uniformOrders).set({ paidAmount, paymentStatus, updatedAt: now }).where(eq(uniformOrders.id, order.id)),
    ]);
    return { ok: true, data: { paymentStatus, paidAmount } };
  } catch (err) {
    if (key) { try { await storage.delete(key); } catch { /* best-effort */ } }
    const mapped = d1WriteErrorStatus(err, "konfirmasi pembayaran seragam");
    if (mapped) return { ok: false, ...mapped } as InvoiceError;
    throw err;
  }
}

export async function lookupBookByToken(database: AppDatabase, token: string) {
  const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.paymentToken, token));
  if (!order) return null;
  const [student] = await database.select().from(students).where(eq(students.id, order.studentId));
  const lines = await database.select().from(studentOrderItems).where(eq(studentOrderItems.orderId, order.id));
  return { order, student, lines, due: invoiceTotal(order.totalAmount, order.shippingCost ?? 0) };
}

export async function lookupUniformByToken(database: AppDatabase, token: string) {
  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.paymentToken, token));
  if (!order) return null;
  const [student] = await database.select().from(students).where(eq(students.id, order.studentId));
  const lines = await database.select().from(uniformOrderItems).where(eq(uniformOrderItems.orderId, order.id));
  return { order, student, lines, due: invoiceTotal(order.totalAmount, order.shippingCost ?? 0) };
}
