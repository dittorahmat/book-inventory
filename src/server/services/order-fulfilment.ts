import { and, eq, inArray } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { bookItems, bookReturns, packageItems, studentBookOrders } from "../../db/schema";
import { AVAILABLE_LOOSE_STATUSES, READY_BUNDLE_STATUSES, RETURNABLE_CONDITIONS } from "./stock-buckets";
import { d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import {
  RETURN_OPEN_STATUSES,
  checkHandoverBundle,
  checkReplacementLoose,
  checkResolveTransition,
  targetReturnStatus,
} from "./return-flow";

export { RETURN_OPEN_STATUSES, checkResolveTransition, targetReturnStatus };
export type { BundleRow, LooseRow, OrderRef } from "./return-flow";

export type FulfilmentError = { ok: false; status: ContentfulStatusCode; message: string };

export interface HandoverInput {
  recipientName: string;
  packageItemId?: string;
  notes?: string;
}

export type HandoverResult =
  | {
      ok: true;
      data: {
        orderId: string;
        deliveryNumber: string;
        handoverDate: string;
        handoverRecipient: string;
        fulfillmentStatus: "picked_up";
        assignedPackageItemId: string | null;
      };
    }
  | FulfilmentError;

export interface ResolveReturnInput {
  action: "replace" | "reject";
  replacementBookItemId?: string;
  handledByUserId?: string;
}

export type ResolveReturnResult =
  | { ok: true; data: { status: "replaced" | "rejected"; replacementBookItemId: string | null } }
  | FulfilmentError;

const handoverOrderPatch = (
  orderNotes: string | null,
  deliveryNumber: string,
  now: string,
  input: HandoverInput,
  assignedPackageItemId: string | null
) => ({
  fulfillmentStatus: "picked_up" as const,
  handoverDeliveryNumber: deliveryNumber,
  handoverDate: now,
  handoverRecipient: input.recipientName,
  assignedPackageItemId,
  notes: orderNotes,
  updatedAt: now,
});

/**
 * Satu-satunya pemilik serah terima paket (surat jalan): pilih bundel,
 * tandai terkirim, dan catat nomor surat jalan di order.
 * Jalur ID eksplisit melewati guard yang sama dengan alokasi otomatis;
 * seluruh tulis lewat satu batch atomik (seam lib/d1-write, §10 D1).
 */
export async function handoverPackage(
  database: AppDatabase,
  orderId: string,
  input: HandoverInput
): Promise<HandoverResult> {
  const now = new Date().toISOString();
  const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  if (!order) {
    return { ok: false, status: 404, message: "Pesanan tidak ditemukan" };
  }

  const isPaidOrApproved = order.paymentStatus === "paid" || order.paymentStatus === "scholarship_approved";
  if (!isPaidOrApproved && !order.financeHandoverApproved) {
    return {
      ok: false,
      status: 400,
      message:
        "Buku belum dapat diserahkan karena pembayaran belum lunas dan belum ada diskresi persetujuan dari Finance.",
    };
  }

  const deliveryNumber = `SJ-SERAH-${Date.now().toString().slice(-8)}`;
  const orderNotes = input.notes ? `${order.notes || ""} [Handover: ${input.notes}]`.trim() : order.notes;

  if (input.packageItemId) {
    const [bundle] = await database
      .select()
      .from(packageItems)
      .where(eq(packageItems.id, input.packageItemId));
    if (!bundle) {
      return { ok: false, status: 404, message: "Bundel paket tidak ditemukan" };
    }
    const blocked = checkHandoverBundle(bundle, { schoolId: order.schoolId, packageId: order.packageId });
    if (blocked) return blocked;

    const restoreOld =
      order.assignedPackageItemId && order.assignedPackageItemId !== bundle.id
        ? [
            database
              .update(packageItems)
              .set({ status: "in_stock", updatedAt: now })
              .where(eq(packageItems.id, order.assignedPackageItemId)),
          ]
        : [];
    try {
      await runWriteBatch(database, [
        database
          .update(packageItems)
          .set({ status: "delivered", updatedAt: now })
          .where(eq(packageItems.id, bundle.id)),
        ...restoreOld,
        database
          .update(studentBookOrders)
          .set(handoverOrderPatch(orderNotes, deliveryNumber, now, input, bundle.id))
          .where(eq(studentBookOrders.id, orderId)),
      ]);
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "serah terima paket");
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }
    return {
      ok: true,
      data: {
        orderId,
        deliveryNumber,
        handoverDate: now,
        handoverRecipient: input.recipientName,
        fulfillmentStatus: "picked_up",
        assignedPackageItemId: bundle.id,
      },
    };
  }

  if (!order.packageId) {
    try {
      await runWriteBatch(database, [
        database
          .update(studentBookOrders)
          .set(handoverOrderPatch(orderNotes, deliveryNumber, now, input, null))
          .where(eq(studentBookOrders.id, orderId)),
      ]);
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "serah terima paket");
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }
    return {
      ok: true,
      data: {
        orderId,
        deliveryNumber,
        handoverDate: now,
        handoverRecipient: input.recipientName,
        fulfillmentStatus: "picked_up",
        assignedPackageItemId: null,
      },
    };
  }

  const [availableBundle] = await database
    .select()
    .from(packageItems)
    .where(
      and(
        eq(packageItems.packageId, order.packageId),
        eq(packageItems.currentSchoolId, order.schoolId),
        inArray(packageItems.status, [...READY_BUNDLE_STATUSES])
      )
    )
    .limit(1);

  if (!availableBundle) {
    return {
      ok: false,
      status: 400,
      message:
        "Stok paket tidak tersedia di cabang ini untuk diserahkan. Harap rakit paket atau lakukan transfer terlebih dahulu.",
    };
  }

  try {
    await runWriteBatch(database, [
      database
        .update(packageItems)
        .set({ status: "delivered", updatedAt: now })
        .where(eq(packageItems.id, availableBundle.id)),
      database
        .update(studentBookOrders)
        .set(handoverOrderPatch(orderNotes, deliveryNumber, now, input, availableBundle.id))
        .where(eq(studentBookOrders.id, orderId)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "serah terima paket");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    data: {
      orderId,
      deliveryNumber,
      handoverDate: now,
      handoverRecipient: input.recipientName,
      fulfillmentStatus: "picked_up",
      assignedPackageItemId: availableBundle.id,
    },
  };
}

/**
 * Satu-satunya pemilik penyelesaian retur: ganti dari stok satuan
 * (pilih otomatis bila tidak disebut) atau tolak, lalu kembalikan
 * order ke picked_up bila tak ada laporan terbuka lain. Berbagi mesin
 * status dengan reportReturn; seluruh tulis satu batch atomik (§10 D1).
 */
export async function resolveReturn(
  database: AppDatabase,
  returnId: string,
  input: ResolveReturnInput
): Promise<ResolveReturnResult> {
  const now = new Date().toISOString();
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

    return { ok: true, data: { status: "replaced", replacementBookItemId: replacementId || null } };
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

  return { ok: true, data: { status: "rejected", replacementBookItemId: null } };
}
