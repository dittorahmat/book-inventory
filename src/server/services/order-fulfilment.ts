import { and, eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { bookItems, bookReturns, packageItems, studentBookOrders } from "../../db/schema";

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

/**
 * Satu-satunya pemilik serah terima paket (surat jalan): pilih bundel,
 * tandai terkirim, dan catat nomor surat jalan di order.
 * Dipakai jalur staf; kembaran reportReturn di sisi retur.
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

  const deliveryNumber = `SJ-SERAH-${Date.now().toString().slice(-8)}`;

  let assignedItem = input.packageItemId;
  if (!assignedItem && order.packageId) {
    const [availableBundle] = await database
      .select()
      .from(packageItems)
      .where(
        and(
          eq(packageItems.packageId, order.packageId),
          eq(packageItems.currentSchoolId, order.schoolId),
          eq(packageItems.status, "in_stock")
        )
      )
      .limit(1);

    if (!availableBundle) {
      return {
        ok: false,
        status: 400,
        message: "Stok paket tidak tersedia di cabang ini untuk diserahkan. Harap rakit paket atau lakukan transfer terlebih dahulu.",
      };
    }

    assignedItem = availableBundle.id;
    await database
      .update(packageItems)
      .set({ status: "delivered", updatedAt: now })
      .where(eq(packageItems.id, availableBundle.id));
  }

  await database
    .update(studentBookOrders)
    .set({
      fulfillmentStatus: "picked_up",
      handoverDeliveryNumber: deliveryNumber,
      handoverDate: now,
      handoverRecipient: input.recipientName,
      assignedPackageItemId: assignedItem || null,
      notes: input.notes ? `${order.notes || ""} [Handover: ${input.notes}]`.trim() : order.notes,
      updatedAt: now,
    })
    .where(eq(studentBookOrders.id, orderId));

  return {
    ok: true,
    data: {
      orderId,
      deliveryNumber,
      handoverDate: now,
      handoverRecipient: input.recipientName,
      fulfillmentStatus: "picked_up",
      assignedPackageItemId: assignedItem || null,
    },
  };
}

/**
 * Satu-satunya pemilik penyelesaian retur: ganti dari stok satuan
 * (pilih otomatis bila tidak disebut) atau tolak, lalu kembalikan
 * order ke picked_up. Kembaran reportReturn di sisi intake.
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

  if (input.action === "replace") {
    let replacementId = input.replacementBookItemId;
    if (!replacementId) {
      const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, ret.orderId));
      if (order) {
        const [availableLoose] = await database
          .select()
          .from(bookItems)
          .where(
            and(
              eq(bookItems.bookId, ret.defectiveBookId),
              eq(bookItems.currentSchoolId, order.schoolId),
              eq(bookItems.status, "in_stock"),
              eq(bookItems.condition, "new")
            )
          )
          .limit(1);

        if (availableLoose) {
          replacementId = availableLoose.id;
          await database
            .update(bookItems)
            .set({ status: "disposed", notes: `Replaced defective book return ${returnId}`, updatedAt: now })
            .where(eq(bookItems.id, availableLoose.id));
        }
      }
    }

    await database
      .update(bookReturns)
      .set({
        status: "replaced",
        replacementBookItemId: replacementId || null,
        handledByUserId: input.handledByUserId || null,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(bookReturns.id, returnId));

    await database
      .update(studentBookOrders)
      .set({ fulfillmentStatus: "picked_up", updatedAt: now })
      .where(eq(studentBookOrders.id, ret.orderId));

    return { ok: true, data: { status: "replaced", replacementBookItemId: replacementId || null } };
  }

  await database
    .update(bookReturns)
    .set({
      status: "rejected",
      handledByUserId: input.handledByUserId || null,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(bookReturns.id, returnId));

  return { ok: true, data: { status: "rejected", replacementBookItemId: null } };
}
