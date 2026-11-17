import type { AppDatabase } from "../../../db";
import type { WhatsAppSender } from "../whatsapp";
import { uniformOrders, students } from "../../../db/schema";
import { eq } from "drizzle-orm";

export const UNIFORM_SHIPPING_INSTRUCTIONS_KEY = "uniform_shipping_instructions_template";
export const DEFAULT_UNIFORM_SHIPPING_INSTRUCTIONS =
  "Ini nomor resinya: {resi}. Bisa dicek di web kurir.com dengan memasukkan nomor resi tersebut.";

export interface BuildShippingNotificationInput {
  studentName: string;
  orderNumber: string;
  shippingResi: string;
  instructionsTemplate?: string;
  isPaid: boolean;
}

export const buildUniformShippingText = (input: BuildShippingNotificationInput): string => {
  const instructions = (input.instructionsTemplate || DEFAULT_UNIFORM_SHIPPING_INSTRUCTIONS).replace(
    /\{resi\}/g,
    input.shippingResi
  );

  if (input.isPaid) {
    return (
      `Halo Bapak/Ibu, seragam untuk ananda ${input.studentName} (${input.orderNumber}) telah dikirimkan.\n\n` +
      `${instructions}\n\n` +
      `Terima kasih telah melakukan pemesanan. - Al Wildan Logistics`
    );
  }

  return (
    `Halo Bapak/Ibu, seragam untuk ananda ${input.studentName} (${input.orderNumber}) telah dikirimkan.\n\n` +
    `${instructions}\n\n` +
    `Mohon pastikan sisa tagihan/administrasi telah diselesaikan. - Al Wildan Logistics`
  );
};

export interface SendShippingNotificationDeps {
  sender?: WhatsAppSender;
}

export interface SendShippingNotificationResult {
  sent: boolean;
  recipientPhone: string | null;
  error?: string;
}

import { dispatchOrderNotification } from "../order-notification-hub";

export async function sendUniformShippingNotification(
  database: AppDatabase,
  orderId: string,
  deps?: SendShippingNotificationDeps
): Promise<SendShippingNotificationResult> {
  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  if (!order) return { sent: false, recipientPhone: null, error: "Order seragam tidak ditemukan." };
  if (!order.shippingResi) return { sent: false, recipientPhone: null, error: "Nomor resi kurir belum terisi." };

  const [student] = await database.select().from(students).where(eq(students.id, order.studentId));
  if (!student?.parentPhone) {
    return { sent: false, recipientPhone: null, error: "Nomor WA orang tua tidak tersedia." };
  }

  const dispatchResult = await dispatchOrderNotification(
    database,
    {
      type: "uniform_shipped",
      recipientPhone: student.parentPhone,
      input: {
        studentName: student.name,
        orderNumber: order.orderNumber,
        shippingResi: order.shippingResi,
        isPaid: order.paymentStatus === "paid",
      },
    },
    deps?.sender
  );

  return {
    sent: dispatchResult.success,
    recipientPhone: student.parentPhone,
    error: dispatchResult.success ? undefined : (dispatchResult.error ?? "Gagal mengirim pesan WhatsApp"),
  };
}

/** Konfirmasi penerimaan seragam oleh staf logistik (audit). */
export async function confirmUniformReceipt(
  database: AppDatabase,
  orderId: string,
  notes?: string
): Promise<{ ok: true; data: typeof uniformOrders.$inferSelect } | { ok: false; status: 400 | 404; message: string }> {
  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  if (!order) return { ok: false, status: 404, message: "Order seragam tidak ditemukan." };
  if (order.shipmentStatus !== "sudah_dikirim") {
    return { ok: false, status: 400, message: "Hanya pesanan yang sudah dikirim yang dapat dikonfirmasi penerimaannya." };
  }

  const now = new Date().toISOString();
  await database
    .update(uniformOrders)
    .set({
      receivedAt: now,
      receivedNotes: notes?.trim() || null,
      updatedAt: now,
    })
    .where(eq(uniformOrders.id, orderId));

  const [updated] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  return { ok: true, data: updated };
}
