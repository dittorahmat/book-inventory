import type { AppDatabase } from "../../../db";
import { readSettingsMap } from "../settings-map";
import type { WhatsAppSender } from "../whatsapp";
import { MetaWhatsAppSender } from "../whatsapp";

export const UNIFORM_ORDER_WA_TEMPLATE_KEY = "uniform_order_wa_template";
export const UNIFORM_ORDER_WA_ENABLED_KEY = "uniform_order_wa_enabled";

export const DEFAULT_UNIFORM_ORDER_WA_TEMPLATE =
  "Halo Bapak/Ibu {parent_name},\n\nTerima kasih sudah memesan seragam untuk ananda {student_name}.\nPesanan Anda telah kami terima dengan No. Pesanan: *{order_number}* dan sedang diproses oleh tim logistik {school_name}.\n\nTerima kasih.";

export interface BuildUniformOrderWhatsAppInput {
  parentName: string;
  studentName: string;
  orderNumber: string;
  schoolName: string;
  template?: string;
}

export function buildUniformOrderWhatsAppText(input: BuildUniformOrderWhatsAppInput): string {
  const template = input.template || DEFAULT_UNIFORM_ORDER_WA_TEMPLATE;
  return template
    .replace(/\{parent_name\}/g, input.parentName)
    .replace(/\{student_name\}/g, input.studentName)
    .replace(/\{order_number\}/g, input.orderNumber)
    .replace(/\{school_name\}/g, input.schoolName);
}

export interface SendUniformOrderNotificationInput {
  recipientPhone: string;
  parentName: string;
  studentName: string;
  orderNumber: string;
  schoolName: string;
}

export async function sendUniformOrderWhatsApp(
  database: AppDatabase,
  input: SendUniformOrderNotificationInput,
  sender?: WhatsAppSender
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  if (!input.recipientPhone?.trim()) return { success: false, error: "Nomor telepon tujuan kosong." };

  const settings = await readSettingsMap(database);
  if (settings[UNIFORM_ORDER_WA_ENABLED_KEY] === "false") {
    return { success: true, skipped: true };
  }

  const template = settings[UNIFORM_ORDER_WA_TEMPLATE_KEY] || DEFAULT_UNIFORM_ORDER_WA_TEMPLATE;
  const message = buildUniformOrderWhatsAppText({ ...input, template });

  const client = sender || new MetaWhatsAppSender(database);
  const res = await client.send({ to: input.recipientPhone, text: message });
  return { success: res.success, error: res.error };
}
