import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { packageItems, studentBookOrders, students } from "../../db/schema";
import { READY_BUNDLE_STATUSES } from "./stock";
import { d1WriteErrorStatus, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";
import { documentNumber, isoTimeFragment } from "../lib/document-number";
import { emitChargeQuery } from "./branch-charges";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { checkHandoverBundle } from "./stock";

export interface HandoverInput {
  recipientName: string;
  packageItemId?: string;
  notes?: string;
}

export type HandoverError = { ok: false; status: ContentfulStatusCode; message: string };

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
  | HandoverError;

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
  input: HandoverInput,
  deps?: WriteDeps
): Promise<HandoverResult> {
  const now = writeNow(deps);
  const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  if (!order) {
    return { ok: false, status: 404, message: "Pesanan tidak ditemukan" };
  }

  // Sesuai ADR-0018: Buku dapat diambil oleh pemegang Bukti Pengambilan resmi
  // baik yang sudah lunas (paid), cicilan (partial), maupun beasiswa (scholarship_approved).
  // Status unpaid murni (tanpa bukti & tanpa diskresi) tetap ditahan.
  const canHandover =
    order.paymentStatus === "paid" ||
    order.paymentStatus === "partial" ||
    order.paymentStatus === "scholarship_approved" ||
    order.financeHandoverApproved;
  if (!canHandover) {
    return {
      ok: false,
      status: 400,
      message:
        "Buku belum dapat diserahkan karena belum ada konfirmasi pembayaran/cicilan atau diskresi persetujuan dari Finance.",
    };
  }

  const deliveryNumber = documentNumber("SJ-SERAH", isoTimeFragment(now, 8));
  const orderNotes = input.notes ? `${order.notes || ""} [Handover: ${input.notes}]`.trim() : order.notes;

  // Paket kirim-rumah wajib ongkir (nominal atau resi) sebelum serah-terima.
  if (order.packageId && order.homeAddressSnapshot?.trim()) {
    const hasShipping = (order.shippingCost ?? 0) > 0 || !!order.shippingResi?.trim();
    if (!hasShipping) {
      return { ok: false, status: 400, message: "Input ongkir terlebih dahulu untuk paket kirim-rumah." };
    }
  }

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
        ...(order.packageId
          ? [database.update(students).set({ hasTakenPackage: true, packageReceivedAt: now, updatedAt: now }).where(eq(students.id, order.studentId))]
          : []),
        // Paket buku dipegang cabang (konsinyasi) → ditagihkan saat serah-terima.
        // Order campuran sudah punya tagihan dari pembuatan order; unique sumber = no-op.
        ...(order.packageId
          ? [
              emitChargeQuery(database, {
                schoolId: order.schoolId,
                sourceType: "book_order",
                sourceId: orderId,
                triggerEvent: "handover",
                goodsAmount: order.totalAmount,
              }, deps),
            ]
          : []),
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
    .orderBy(packageItems.createdAt)
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
      database.update(students).set({ hasTakenPackage: true, packageReceivedAt: now, updatedAt: now }).where(eq(students.id, order.studentId)),
      emitChargeQuery(database, {
        schoolId: order.schoolId,
        sourceType: "book_order",
        sourceId: orderId,
        triggerEvent: "handover",
        goodsAmount: order.totalAmount,
      }, deps),
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
