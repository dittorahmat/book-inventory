import type { AppDatabase } from "../../db";
import { systemSettings } from "../../db/schema";
import { runWriteBatch } from "../lib/d1-write";
import { readSettingsMap } from "./settings-map";

export const WA_PAYMENT_CONFIRMATION_TEMPLATE_KEY = "payment_confirmation_wa_template";
export const WA_PAYMENT_CONFIRMATION_ENABLED_KEY = "payment_confirmation_wa_enabled";
export const WA_UNIFORM_ORDER_TEMPLATE_KEY = "uniform_order_wa_template";
export const WA_UNIFORM_ORDER_ENABLED_KEY = "uniform_order_wa_enabled";

export const DEFAULT_PAYMENT_CONFIRMATION_WA_TEMPLATE =
  "Terima kasih Bapak/Ibu wali dari {nama_murid} ({nis}), pembayaran paket buku program {program} jenjang {jenjang} di {nama_sekolah} telah kami terima dan terverifikasi lunas.\nMohon tunggu pengumuman dari sekolah untuk jadwal pembagian buku fisik.\nHarap simpan dan bawa pesan WhatsApp ini beserta kode pengambilan {kode_pengambilan} sebagai bukti sah saat pengambilan buku.";

export const DEFAULT_UNIFORM_ORDER_WA_TEMPLATE =
  "Halo Bapak/Ibu {parent_name},\n\nTerima kasih sudah memesan seragam untuk ananda {student_name}.\nPesanan Anda telah kami terima dengan No. Pesanan: *{order_number}* dan sedang diproses oleh tim logistik {school_name}.\n\nTerima kasih.";

export interface MetaWhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  isEnabled: boolean;
  isPaymentConfirmationWaEnabled?: boolean;
  isUniformOrderWaEnabled?: boolean;
  paymentConfirmationTemplate?: string;
  uniformOrderTemplate?: string;
}

export async function getMetaWhatsAppConfig(database: AppDatabase): Promise<MetaWhatsAppConfig> {
  const map = await readSettingsMap(database);
  return {
    phoneNumberId: map["wa_meta_phone_id"] ?? "",
    accessToken: map["wa_meta_token"] ?? "",
    isEnabled: map["wa_meta_enabled"] === "true",
    isPaymentConfirmationWaEnabled: map[WA_PAYMENT_CONFIRMATION_ENABLED_KEY] !== "false",
    isUniformOrderWaEnabled: map[WA_UNIFORM_ORDER_ENABLED_KEY] !== "false",
    paymentConfirmationTemplate: map[WA_PAYMENT_CONFIRMATION_TEMPLATE_KEY] ?? DEFAULT_PAYMENT_CONFIRMATION_WA_TEMPLATE,
    uniformOrderTemplate: map[WA_UNIFORM_ORDER_TEMPLATE_KEY] ?? DEFAULT_UNIFORM_ORDER_WA_TEMPLATE,
  };
}

export async function saveMetaWhatsAppConfig(database: AppDatabase, config: MetaWhatsAppConfig): Promise<void> {
  const now = new Date().toISOString();
  const entries: Array<[string, string]> = [
    ["wa_meta_phone_id", config.phoneNumberId],
    ["wa_meta_token", config.accessToken],
    ["wa_meta_enabled", config.isEnabled ? "true" : "false"],
  ];
  if (config.isPaymentConfirmationWaEnabled !== undefined) {
    entries.push([WA_PAYMENT_CONFIRMATION_ENABLED_KEY, config.isPaymentConfirmationWaEnabled ? "true" : "false"]);
  }
  if (config.isUniformOrderWaEnabled !== undefined) {
    entries.push([WA_UNIFORM_ORDER_ENABLED_KEY, config.isUniformOrderWaEnabled ? "true" : "false"]);
  }
  if (config.paymentConfirmationTemplate !== undefined) {
    entries.push([WA_PAYMENT_CONFIRMATION_TEMPLATE_KEY, config.paymentConfirmationTemplate]);
  }
  if (config.uniformOrderTemplate !== undefined) {
    entries.push([WA_UNIFORM_ORDER_TEMPLATE_KEY, config.uniformOrderTemplate]);
  }
  await runWriteBatch(
    database,
    entries.map(([key, value]) =>
      database
        .insert(systemSettings)
        .values({ key, value, updatedAt: now })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: now } })
    )
  );
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

export interface WhatsAppRequest {
  to: string;
  text: string;
}

/**
 * Seam pengiriman WhatsApp (cermin seam kirim PO).
 * Dua adapter: Meta Official (Cloud API, tanpa socket in-process,
 * aman di runtime Cloudflare Workers) vs in-memory (rekam kiriman,
 * tanpa jaringan; kegagalan dapat diinjeksi sekali untuk test).
 */
export interface WhatsAppSender {
  readonly name: string;
  send(request: WhatsAppRequest): Promise<SendWhatsAppResult>;
}

/** Normalisasi nomor HP Indonesia (0812 -> 62812). Murni, bisa di-unit-test. */
export const normalizeIndonesianPhone = (targetPhone: string): string => {
  const cleanPhone = targetPhone.replace(/\D/g, "");
  return cleanPhone.startsWith("0") ? `62${cleanPhone.slice(1)}` : cleanPhone;
};

/** Adapter Meta Official (Cloud API): tanpa konfigurasi berarti simulasi fail-safe. */
export class MetaWhatsAppSender implements WhatsAppSender {
  readonly name = "meta-official";

  constructor(private readonly database: AppDatabase) {}

  async send(request: WhatsAppRequest): Promise<SendWhatsAppResult> {
    const config = await getMetaWhatsAppConfig(this.database);
    if (!config.isEnabled || !config.phoneNumberId || !config.accessToken) {
      return { success: true, simulated: true, error: "Meta WA belum dikonfigurasi atau dinonaktifkan. Pesan disimulasikan." };
    }
    const cleanPhone = normalizeIndonesianPhone(request.to);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.accessToken}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { body: request.text, preview_url: true },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return { success: false, error: `Meta WA status ${res.status}: ${errBody.slice(0, 150)}` };
      }
      const data = (await res.json().catch(() => ({}))) as { messages?: Array<{ id?: string }> };
      return { success: true, messageId: data.messages?.[0]?.id ?? "sent" };
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "";
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: name === "AbortError" ? "Meta WA request timeout (>8s)" : message || "Gagal menghubungi Meta WA" };
    }
  }
}

/** Adapter in-memory untuk test: tanpa fetch/gateway mock, kegagalan dapat diinjeksi sekali. */
export class InMemoryWhatsAppSender implements WhatsAppSender {
  readonly name = "in-memory";
  readonly sent: WhatsAppRequest[] = [];
  private failNextMessage: string | null;

  constructor(opts?: { failNext?: string }) {
    this.failNextMessage = opts?.failNext ?? null;
  }

  failOnce(message: string): void {
    this.failNextMessage = message;
  }

  async send(request: WhatsAppRequest): Promise<SendWhatsAppResult> {
    if (this.failNextMessage) {
      const error = this.failNextMessage;
      this.failNextMessage = null;
      return { success: false, error };
    }
    this.sent.push(request);
    return { success: true, messageId: `wa-mem-${this.sent.length}` };
  }
}
