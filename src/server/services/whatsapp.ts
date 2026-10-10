import type { AppDatabase } from "../../db";
import { systemSettings } from "../../db/schema";

export interface WhatsAppConfig {
  gatewayUrl: string;
  apiKey: string;
  senderNumber?: string;
  isEnabled: boolean;
}

export async function getWhatsAppConfig(database: AppDatabase): Promise<WhatsAppConfig> {
  const rows = await database.select().from(systemSettings);
  type SettingRow = (typeof rows)[number];
  const map = new Map<string, string>(rows.map((r: SettingRow) => [r.key, r.value]));

  return {
    gatewayUrl: map.get("wa_gateway_url") ?? "",
    apiKey: map.get("wa_api_key") ?? "",
    senderNumber: map.get("wa_sender_number") ?? "",
    isEnabled: map.get("wa_enabled") === "true",
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

  for (const [key, value] of entries) {
    await database
      .insert(systemSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: now } });
  }
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

/**
 * Mengirim pesan WhatsApp via external REST gateway / sidecar.
 * Berjalan aman di runtime Cloudflare Workers tanpa socket dependencies in-process.
 */
export async function sendWhatsAppMessage(
  targetPhone: string,
  messageText: string,
  database: AppDatabase
): Promise<SendWhatsAppResult> {
  const config = await getWhatsAppConfig(database);

  // Jika belum dikonfigurasi atau dinonaktifkan, simulasikan tanpa gagal (fail-safe)
  if (!config.isEnabled || !config.gatewayUrl) {
    console.info(`[WhatsApp Simulation] To: ${targetPhone} | Message: ${messageText.slice(0, 60)}...`);
    return {
      success: true,
      simulated: true,
      error: "WhatsApp gateway belum dikonfigurasi atau dinonaktifkan. Pesan disimulasikan.",
    };
  }

  // Format nomor HP Indonesia (e.g. 0812 -> 62812)
  let cleanPhone = targetPhone.replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "62" + cleanPhone.slice(1);
  }

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
        message: messageText,
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

    const data = await res.json().catch(() => ({}));
    return {
      success: true,
      messageId: (data as any)?.id || (data as any)?.messageId || "sent",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.name === "AbortError" ? "Gateway request timeout (>6s)" : err.message || "Failed to reach WhatsApp gateway",
    };
  }
}
