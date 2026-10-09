import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, type AppDatabase } from "../../db";
import {
  suppliers,
  purchaseOrders,
  purchaseOrderItems,
  books,
  schools,
} from "../../db/schema";
import type { EmailRuntimeEnv } from "./email/types";
import { renderPurchaseOrderEmail } from "./email/po-template";
import { RealPoMailSender, type PoMailSender } from "./po-mail";

export type PoSendOutcome =
  | {
      kind: "sent";
      poId: string;
      poNumber: string;
      sentTo: string;
      sentAt: string;
      provider: string;
      messageId?: string;
    }
  | {
      kind: "simulated";
      poId: string;
      poNumber: string;
      sentTo: string;
      provider: string;
      detail: string;
    }
  | { kind: "error"; httpStatus: 400 | 404 | 502; message: string; provider?: string };

export interface PoDeliveryDeps {
  mail?: PoMailSender;
  env?: EmailRuntimeEnv;
}

/**
 * Seam delivery internal milik modul po-lifecycle: render template + kirim via
 * adapter mail yang diinjeksi + catat jejak kirim.
 * `sent`/`sentAt`/`sentTo` hanya diubah bila email benar-benar terkirim
 * (simulasi dan kegagalan tidak mengubah status PO).
 */
export async function deliverPurchaseOrder(
  database: AppDatabase,
  poId: string,
  deps: PoDeliveryDeps = {}
): Promise<PoSendOutcome> {
  const [po] = await database.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) {
    return { kind: "error", httpStatus: 404, message: "Purchase Order tidak ditemukan" };
  }
  if (po.status === "cancelled") {
    return {
      kind: "error",
      httpStatus: 400,
      message: `PO ${po.poNumber} sudah dibatalkan dan tidak dapat dikirim`,
    };
  }

  const [supplier] = await database
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, po.supplierId));
  const emailCheck = z.string().email().safeParse(supplier?.email || "");
  if (!emailCheck.success) {
    return {
      kind: "error",
      httpStatus: 400,
      message: "Email supplier belum diisi / tidak valid. Lengkapi email supplier sebelum mengirim PO.",
    };
  }
  const supplierEmail = emailCheck.data;

  const [school] = await database
    .select()
    .from(schools)
    .where(eq(schools.id, po.targetSchoolId));

  const items = await database
    .select({
      title: books.title,
      isbn: books.isbn,
      quantityOrdered: purchaseOrderItems.quantityOrdered,
      unitPrice: purchaseOrderItems.unitPrice,
      discountPercent: purchaseOrderItems.discountPercent,
    })
    .from(purchaseOrderItems)
    .innerJoin(books, eq(purchaseOrderItems.bookId, books.id))
    .where(eq(purchaseOrderItems.purchaseOrderId, poId));

  const { subject, html, text } = renderPurchaseOrderEmail({
    poNumber: po.poNumber,
    orderDate: po.orderDate,
    expectedArrivalDate: po.expectedArrivalDate,
    schoolName: school?.name || po.targetSchoolId,
    supplierName: supplier?.name || supplierEmail,
    items,
    totalAmount: po.totalAmount,
    notes: po.notes,
  });

  const sender: PoMailSender = deps.mail ?? new RealPoMailSender(deps.env);
  const result = await sender.send({ to: supplierEmail, subject, html, text });

  if (!result.success) {
    return {
      kind: "error",
      httpStatus: 502,
      message: `Gagal mengirim PO ${po.poNumber} via ${result.provider}: ${result.error}`,
      provider: result.provider,
    };
  }

  if (result.simulated) {
    return {
      kind: "simulated",
      poId: po.id,
      poNumber: po.poNumber,
      sentTo: supplierEmail,
      provider: result.provider,
      detail:
        result.error ||
        "Kredensial email belum dikonfigurasi. Lengkapi di Pengaturan SMTP agar PO benar-benar terkirim.",
    };
  }

  const now = new Date().toISOString();
  await database
    .update(purchaseOrders)
    .set({ status: "sent", sentAt: now, sentTo: supplierEmail, updatedAt: now })
    .where(eq(purchaseOrders.id, poId));

  return {
    kind: "sent",
    poId: po.id,
    poNumber: po.poNumber,
    sentTo: supplierEmail,
    sentAt: now,
    provider: result.provider,
    messageId: result.messageId,
  };
}

/** Kompatibilitas: pemanggil lama tanpa injeksi database/adapter. */
export async function sendPurchaseOrderEmail(
  poId: string,
  env?: EmailRuntimeEnv
): Promise<PoSendOutcome> {
  return deliverPurchaseOrder(db, poId, { env });
}
