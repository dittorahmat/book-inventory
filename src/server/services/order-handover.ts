import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { packageItems, studentBookOrders } from "../../db/schema";
import { READY_BUNDLE_STATUSES } from "./stock-buckets";
import { d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import { checkHandoverBundle } from "./return-flow";
import type { FulfilmentError } from "./order-fulfilment";

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
