import { eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { bookReturns, packageItems, studentBookOrders } from "../../db/schema";
import { d1WriteErrorStatus, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";

export type FinanceError = { ok: false; status: ContentfulStatusCode; message: string };

export interface DiscretionInput {
  discretionType: "discount" | "scholarship" | "handover_override";
  discountAmount?: number;
  discretionNotes: string;
}

export type DiscretionResult =
  | { ok: true; data: { orderId: string; discretionType: DiscretionInput["discretionType"]; totalAmount: number; paymentStatus: string } }
  | FinanceError;

export type CancelOrderResult =
  | { ok: true; data: { orderId: string } }
  | FinanceError;

/**
 * Satu-satunya pemilik diskresi finance atas pesanan siswa: potong harga,
 * beasiswa 100%, atau izin ambil handover — dihitung dan ditulis di satu
 * tempat agar paid/partial tak pernah salah setelah potongan.
 */
export async function applyDiscretion(
  database: AppDatabase,
  orderId: string,
  input: DiscretionInput,
  deps?: WriteDeps
): Promise<DiscretionResult> {
  const now = writeNow(deps);
  const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  if (!order) {
    return { ok: false, status: 404, message: "Pesanan tidak ditemukan" };
  }
  if (!input.discretionNotes?.trim()) {
    return { ok: false, status: 400, message: "Catatan/alasan diskresi finance wajib diisi" };
  }

  const patch: {
    discretionType: DiscretionInput["discretionType"];
    discretionNotes: string;
    discretionByUserId: null;
    updatedAt: string;
    orderType?: "regular" | "scholarship";
    totalAmount?: number;
    paymentStatus?: "unpaid" | "partial" | "paid" | "scholarship_pending" | "scholarship_approved" | "scholarship_rejected";
    financeHandoverApproved?: boolean;
    discountAmount?: number;
  } = {
    discretionType: input.discretionType,
    discretionNotes: input.discretionNotes,
    discretionByUserId: null,
    updatedAt: now,
  };
  if (input.discretionType === "scholarship") {
    Object.assign(patch, { orderType: "scholarship", totalAmount: 0, paymentStatus: "scholarship_approved", financeHandoverApproved: true });
  } else if (input.discretionType === "discount") {
    const newTotal = Math.max(0, order.totalAmount - (input.discountAmount ?? 0));
    Object.assign(patch, { discountAmount: input.discountAmount ?? 0, totalAmount: newTotal, paymentStatus: order.paidAmount >= newTotal ? "paid" : "partial" });
  } else {
    Object.assign(patch, { financeHandoverApproved: true });
  }

  try {
    await runWriteBatch(database, [
      database.update(studentBookOrders).set(patch).where(eq(studentBookOrders.id, orderId)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "diskresi finance");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    data: {
      orderId,
      discretionType: input.discretionType,
      totalAmount: patch.totalAmount ?? order.totalAmount,
      paymentStatus: patch.paymentStatus ?? order.paymentStatus,
    },
  };
}

/**
 * Satu-satunya pemilik pembatalan pesanan siswa: kembalikan bundel ke
 * in_stock, hapus laporan retur terkait dan pesanan — satu batch atomik
 * agar tak ada bundel nyangkut reserved atau retur yatim.
 */
export async function cancelStudentOrder(
  database: AppDatabase,
  orderId: string,
  deps?: WriteDeps
): Promise<CancelOrderResult> {
  const now = writeNow(deps);
  const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  if (!order) {
    return { ok: false, status: 404, message: "Pesanan tidak ditemukan" };
  }

  try {
    await runWriteBatch(database, [
      ...(order.assignedPackageItemId
        ? [database.update(packageItems).set({ status: "in_stock", updatedAt: now }).where(eq(packageItems.id, order.assignedPackageItemId as string))]
        : []),
      database.delete(bookReturns).where(eq(bookReturns.orderId, orderId)),
      database.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pembatalan pesanan");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return { ok: true, data: { orderId } };
}
