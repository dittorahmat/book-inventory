import type { AppDatabase } from "../../db";
import { readSettingsMap } from "./settings-map";
import type { WhatsAppSender } from "./whatsapp";
import {
  MetaWhatsAppSender,
  DEFAULT_PAYMENT_CONFIRMATION_WA_TEMPLATE,
  WA_PAYMENT_CONFIRMATION_TEMPLATE_KEY,
  WA_PAYMENT_CONFIRMATION_ENABLED_KEY,
} from "./whatsapp";
import {
  buildPaidOffNotice,
  buildRejectedNotice,
  type PaidOffNoticeInput,
  type RejectedNoticeInput,
} from "./order-paid-notify";
import {
  buildUniformOrderWhatsAppText,
  DEFAULT_UNIFORM_ORDER_WA_TEMPLATE,
  UNIFORM_ORDER_WA_TEMPLATE_KEY,
  UNIFORM_ORDER_WA_ENABLED_KEY,
} from "./uniform/order-notify";
import {
  buildUniformShippingText,
  DEFAULT_UNIFORM_SHIPPING_INSTRUCTIONS,
  UNIFORM_SHIPPING_INSTRUCTIONS_KEY,
} from "./uniform/dispatch-notification";

export type OrderNotificationEvent =
  | { type: "payment_verified"; input: PaidOffNoticeInput; recipientPhone?: string }
  | { type: "payment_rejected"; input: RejectedNoticeInput; recipientPhone?: string }
  | {
      type: "uniform_order_created";
      input: { parentName: string; studentName: string; orderNumber: string; schoolName: string };
      recipientPhone?: string;
    }
  | {
      type: "uniform_shipped";
      input: { studentName: string; orderNumber: string; shippingResi: string; isPaid: boolean };
      recipientPhone?: string;
    };

export interface DispatchNotificationResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Deep Module: OrderNotificationHub
 * Menyembunyikan orkestrasi template pesan, pembacaan konfigurasi settings,
 * fallback fail-safe, dan seleksi adapter di balik antarmuka event domain.
 */
export async function dispatchOrderNotification(
  database: AppDatabase,
  event: OrderNotificationEvent,
  sender?: WhatsAppSender
): Promise<DispatchNotificationResult> {
  const phone = event.recipientPhone?.trim();
  if (!phone) {
    return { success: false, error: "Nomor telepon tujuan kosong." };
  }

  const activeSender = sender ?? new MetaWhatsAppSender(database);
  const settings = await readSettingsMap(database);

  let messageText = "";

  switch (event.type) {
    case "payment_verified": {
      if (settings[WA_PAYMENT_CONFIRMATION_ENABLED_KEY] === "false") {
        return { success: true, skipped: true };
      }
      const template = settings[WA_PAYMENT_CONFIRMATION_TEMPLATE_KEY] || DEFAULT_PAYMENT_CONFIRMATION_WA_TEMPLATE;
      messageText = buildPaidOffNotice({ ...event.input, template });
      break;
    }

    case "payment_rejected": {
      messageText = buildRejectedNotice(event.input);
      break;
    }

    case "uniform_order_created": {
      if (settings[UNIFORM_ORDER_WA_ENABLED_KEY] === "false") {
        return { success: true, skipped: true };
      }
      const template = settings[UNIFORM_ORDER_WA_TEMPLATE_KEY] || DEFAULT_UNIFORM_ORDER_WA_TEMPLATE;
      messageText = buildUniformOrderWhatsAppText({ ...event.input, template });
      break;
    }

    case "uniform_shipped": {
      const instructionsTemplate = settings[UNIFORM_SHIPPING_INSTRUCTIONS_KEY] || DEFAULT_UNIFORM_SHIPPING_INSTRUCTIONS;
      messageText = buildUniformShippingText({ ...event.input, instructionsTemplate });
      break;
    }
  }

  const sendResult = await activeSender.send({ to: phone, text: messageText });
  return {
    success: sendResult.success,
    error: sendResult.error,
    messageId: sendResult.messageId,
  };
}
