import type { AppDatabase } from "../../db";
import { systemSettings } from "../../db/schema";
import { runWriteBatch } from "../lib/d1-write";
import { readSettingsMap } from "./settings-map";

export interface WhatsAppConfig {
  gatewayUrl: string;
  apiKey: string;
  senderNumber?: string;
  isEnabled: boolean;
}

export async function getWhatsAppConfig(database: AppDatabase): Promise<WhatsAppConfig> {
  const map = await readSettingsMap(database);

  return {
    gatewayUrl: map["wa_gateway_url"] ?? "",
    apiKey: map["wa_api_key"] ?? "",
    senderNumber: map["wa_sender_number"] ?? "",
    isEnabled: map["wa_enabled"] === "true",
  };
}

export async function saveWhatsAppConfig(database: AppDatabase, config: WhatsAppConfig): Promise<void> {
  const now = new Date().toISOString();
  const entries: Array<[string, string]> = [
    ["wa_gateway_url", config.gatewayUrl],
    ["wa_api_key", config.apiKey],
    ["wa_sender_number", config.senderNumber || ""],
    ["wa_enabled", config.isEnabled ? "true" : "false"],
  ];

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
 * Dua adapter: nyata (via gateway eksternal, tanpa socket in-process,
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

/** Adapter nyata: gateway REST eksternal; tanpa konfigurasi berarti simulasi fail-safe. */
export class RealWhatsAppSender implements WhatsAppSender {
  readonly name = "real";

  constructor(private readonly database: AppDatabase) {}

  async send(request: WhatsAppRequest): Promise<SendWhatsAppResult> {
    const config = await getWhatsAppConfig(this.database);

    // Jika belum dikonfigurasi atau dinonaktifkan, simulasikan tanpa gagal (fail-safe)
    if (!config.isEnabled || !config.gatewayUrl) {
      console.info(`[WhatsApp Simulation] To: ${request.to} | Message: ${request.text.slice(0, 60)}...`);
      return {
        success: true,
        simulated: true,
        error: "WhatsApp gateway belum dikonfigurasi atau dinonaktifkan. Pesan disimulasikan.",
      };
    }

    const cleanPhone = normalizeIndonesianPhone(request.to);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000); // 6 detik batas timeout

      const res = await fetch(config.gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          to: cleanPhone,
          message: request.text,
          sender: config.senderNumber || undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return {
          success: false,
          error: `Gateway returned status ${res.status}: ${errBody.slice(0, 150)}`,
        };
      }

      const data: unknown = await res.json().catch(() => ({}));
      const record = data as { id?: string; messageId?: string };
      return {
        success: true,
        messageId: record?.id || record?.messageId || "sent",
      };
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "";
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: name === "AbortError" ? "Gateway request timeout (>6s)" : message || "Failed to reach WhatsApp gateway",
      };
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
