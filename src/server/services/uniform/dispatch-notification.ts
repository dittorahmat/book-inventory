import type { AppDatabase } from "../../../db";
import { readSettingsMap } from "../settings-map";
import type { WhatsAppSender } from "../whatsapp";
import { MetaWhatsAppSender } from "../whatsapp";
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

  const settings = await readSettingsMap(database);
  const template = settings[UNIFORM_SHIPPING_INSTRUCTIONS_KEY] || DEFAULT_UNIFORM_SHIPPING_INSTRUCTIONS;

  const text = buildUniformShippingText({
    studentName: student.name,
    orderNumber: order.orderNumber,
    shippingResi: order.shippingResi,
    instructionsTemplate: template,
    isPaid: order.paymentStatus === "paid",
  });

  const sender = deps?.sender ?? new MetaWhatsAppSender(database);
  const result = await sender.send({
    to: student.parentPhone,
    text,
  });

  return {
    sent: result.success,
    recipientPhone: student.parentPhone,
    error: result.success ? undefined : (result.error ?? "Gagal mengirim pesan WhatsApp"),
  };
}
