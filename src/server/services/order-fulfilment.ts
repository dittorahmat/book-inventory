import { and, eq, inArray } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { bookItems, bookReturns, packageItems, studentBookOrders } from "../../db/schema";
import { AVAILABLE_LOOSE_STATUSES, RETURNABLE_CONDITIONS } from "./stock-buckets";
import { d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import {
  RETURN_OPEN_STATUSES,
  checkReplacementLoose,
  checkResolveTransition,
  targetReturnStatus,
} from "./return-flow";

export { RETURN_OPEN_STATUSES, checkResolveTransition, targetReturnStatus };
export type { BundleRow, LooseRow, OrderRef } from "./return-flow";

export type FulfilmentError = { ok: false; status: ContentfulStatusCode; message: string };

export interface ResolveReturnInput {
  action: "replace" | "reject" | "refund";
  replacementBookItemId?: string;
  refundAmount?: number;
  handledByUserId?: string;
}

export type ResolveReturnResult =
  | { ok: true; data: { status: "replaced" | "rejected" | "refunded"; replacementBookItemId: string | null; refundAmount: number; restoredBookItemId: string | null } }
  | FulfilmentError;

export interface ResolveDeps {
  now?: string;
  generateId?: () => string;
}

const resolveNow = (deps?: ResolveDeps): string => deps?.now ?? new Date().toISOString();
const resolveNewId = (deps?: ResolveDeps): string => (deps?.generateId ? deps.generateId() : crypto.randomUUID());

export interface DiscretionInput {
  discretionType: "discount" | "scholarship" | "handover_override";
  discountAmount?: number;
  discretionNotes: string;
}

export type DiscretionResult =
  | { ok: true; data: { orderId: string; discretionType: DiscretionInput["discretionType"]; totalAmount: number; paymentStatus: string } }
  | FulfilmentError;

export type CancelOrderResult =
  | { ok: true; data: { orderId: string } }
  | FulfilmentError;

/**
 * Satu-satunya pemilik penyelesaian retur: ganti dari stok satuan
 * (pilih otomatis bila tidak disebut), tolak, atau refund dana sekaligus
 * kembalikan 1 stok fisik — lalu kembalikan order ke picked_up bila tak ada
 * laporan terbuka lain. Berbagi mesin status dengan reportReturn; seluruh
 * tulis satu batch atomik (§10 D1).
 */
export async function resolveReturn(
  database: AppDatabase,
  returnId: string,
  input: ResolveReturnInput,
  deps?: ResolveDeps
): Promise<ResolveReturnResult> {
  const now = resolveNow(deps);
  const [ret] = await database.select().from(bookReturns).where(eq(bookReturns.id, returnId));
  if (!ret) {
    return { ok: false, status: 404, message: "Laporan retur tidak ditemukan" };
  }

  const transition = checkResolveTransition(ret.status, input.action);
  if (!transition.ok) return transition;
  if (transition.idempotent) {
    return {
      ok: true,
      data: {
        status: targetReturnStatus(input.action),
        replacementBookItemId: ret.replacementBookItemId,
        refundAmount: ret.refundAmount ?? 0,
        restoredBookItemId: null,
      },
    };
  }

  const [order] = await database
    .select()
    .from(studentBookOrders)
    .where(eq(studentBookOrders.id, ret.orderId));
  if (!order) {
    return { ok: false, status: 404, message: "Pesanan terkait retur tidak ditemukan" };
  }

  const siblingOpen = await database
    .select({ id: bookReturns.id })
    .from(bookReturns)
    .where(
      and(
        eq(bookReturns.orderId, ret.orderId),
        inArray(bookReturns.status, [...RETURN_OPEN_STATUSES])
      )
    );
  const otherOpen = siblingOpen.some((r: { id: string }) => r.id !== returnId);
  const orderStatusAfter = otherOpen ? "return_in_progress" : "picked_up";

  if (input.action === "replace") {
    let replacementId = input.replacementBookItemId;
    const disposeWrites = [];
    if (replacementId) {
      const [item] = await database.select().from(bookItems).where(eq(bookItems.id, replacementId));
      if (!item) {
        return { ok: false, status: 404, message: "Buku pengganti tidak ditemukan" };
      }
      const blocked = checkReplacementLoose(
        item,
        { schoolId: order.schoolId, packageId: order.packageId },
        ret.defectiveBookId
      );
      if (blocked) return blocked;
      disposeWrites.push(
        database
          .update(bookItems)
          .set({ status: "disposed", notes: `Replaced defective book return ${returnId}`, updatedAt: now })
          .where(eq(bookItems.id, replacementId))
      );
    } else {
      const [availableLoose] = await database
        .select()
        .from(bookItems)
        .where(
          and(
            eq(bookItems.bookId, ret.defectiveBookId),
            eq(bookItems.currentSchoolId, order.schoolId),
            inArray(bookItems.status, [...AVAILABLE_LOOSE_STATUSES]),
            inArray(bookItems.condition, [...RETURNABLE_CONDITIONS])
          )
        )
        .limit(1);
      if (availableLoose) {
        replacementId = availableLoose.id;
        disposeWrites.push(
          database
            .update(bookItems)
            .set({ status: "disposed", notes: `Replaced defective book return ${returnId}`, updatedAt: now })
            .where(eq(bookItems.id, availableLoose.id))
        );
      }
    }

    try {
      await runWriteBatch(database, [
        ...disposeWrites,
        database
          .update(bookReturns)
          .set({
            status: "replaced",
            replacementBookItemId: replacementId || null,
            handledByUserId: input.handledByUserId || null,
            resolvedAt: now,
            updatedAt: now,
          })
          .where(eq(bookReturns.id, returnId)),
        database
          .update(studentBookOrders)
          .set({ fulfillmentStatus: orderStatusAfter, updatedAt: now })
          .where(eq(studentBookOrders.id, ret.orderId)),
      ]);
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "penyelesaian retur");
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }

    return { ok: true, data: { status: "replaced", replacementBookItemId: replacementId || null, refundAmount: 0, restoredBookItemId: null } };
  }

  if (input.action === "refund") {
    const refundAmt = input.refundAmount ?? 0;
    const bookItemId = resolveNewId(deps);
    const epoch = String(Date.parse(now) % 1000000).padStart(6, "0");
    const suffix = bookItemId.replace(/-/g, "").slice(0, 3).toUpperCase().padEnd(3, "0");
    try {
      await runWriteBatch(database, [
        database
          .update(bookReturns)
          .set({
            status: "refunded",
            refundAmount: refundAmt,
            handledByUserId: input.handledByUserId || null,
            resolvedAt: now,
            updatedAt: now,
          })
          .where(eq(bookReturns.id, returnId)),
        database.insert(bookItems).values({
          id: bookItemId,
          bookId: ret.defectiveBookId,
          currentSchoolId: order.schoolId,
          barcode: `RFD-${epoch}-${suffix}`,
          condition: "good",
          status: "in_stock",
          notes: `Restored to stock from parent refund (Return #${returnId})`,
          createdAt: now,
          updatedAt: now,
        }),
        database
          .update(studentBookOrders)
          .set({ fulfillmentStatus: orderStatusAfter, updatedAt: now })
          .where(eq(studentBookOrders.id, ret.orderId)),
      ]);
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "refund retur");
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }

    return { ok: true, data: { status: "refunded", replacementBookItemId: null, refundAmount: refundAmt, restoredBookItemId: bookItemId } };
  }

  try {
    await runWriteBatch(database, [
      database
        .update(bookReturns)
        .set({
          status: "rejected",
          handledByUserId: input.handledByUserId || null,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(bookReturns.id, returnId)),
      database
        .update(studentBookOrders)
        .set({ fulfillmentStatus: orderStatusAfter, updatedAt: now })
        .where(eq(studentBookOrders.id, ret.orderId)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "penolakan retur");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return { ok: true, data: { status: "rejected", replacementBookItemId: null, refundAmount: 0, restoredBookItemId: null } };
}

/**
 * Satu-satunya pemilik diskresi finance atas pesanan siswa: potong harga,
 * beasiswa 100%, atau izin ambil handover — dihitung dan ditulis di satu
 * tempat agar paid/partial tak pernah salah setelah potongan.
 */
export async function applyDiscretion(
  database: AppDatabase,
  orderId: string,
  input: DiscretionInput,
  deps?: ResolveDeps
): Promise<DiscretionResult> {
  const now = resolveNow(deps);
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
  deps?: ResolveDeps
): Promise<CancelOrderResult> {
  const now = resolveNow(deps);
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
