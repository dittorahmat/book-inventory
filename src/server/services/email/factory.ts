import { db } from "../../../db";
import { systemSettings } from "../../../db/schema";
import { BrevoHttpProvider } from "./brevo-provider";
import { SmtpProvider } from "./smtp-provider";
import type {
  EmailProvider,
  EmailProviderName,
  EmailProviderSetting,
  EmailRuntimeEnv,
  EmailSendOptions,
  EmailSendResult,
  ResolvedEmailConfig,
} from "./types";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  fromName: string;
  fromEmail: string;
  provider: EmailProviderSetting;
  brevoApiKey?: string;
  brevoApiUrl: string;
}

import { DEFAULT_BREVO_API_URL } from "./types";

const isBunRuntime = (): boolean => typeof (globalThis as any).Bun !== "undefined";

const readSettingsMap = async (): Promise<Record<string, string>> =>
  Object.fromEntries(((await db.select().from(systemSettings)) as any[]).map((r) => [r.key, r.value]));

const pick = (envVal: string | undefined, storedVal: string | undefined, processVal: string | undefined, fallback: string): string =>
  [envVal, storedVal, processVal].find((v) => v !== undefined && v !== "") ?? fallback;

/**
 * Resolusi konfigurasi email.
 * Prioritas per kunci: `env` eksplisit (Workers `c.env`) > `system_settings` > `process.env` > default.
 */
export async function getSmtpConfig(env?: EmailRuntimeEnv): Promise<SmtpConfig> {
  const stored = await readSettingsMap();
  const proc = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;

  const providerRaw = pick(env?.EMAIL_PROVIDER, stored["email_provider"], proc["EMAIL_PROVIDER"], "auto");
  const provider: EmailProviderSetting =
    providerRaw === "brevo" || providerRaw === "smtp" ? providerRaw : "auto";

  return {
    host: pick(env?.SMTP_HOST, stored["smtp_host"], proc["SMTP_HOST"], "smtp.gmail.com"),
    port: parseInt(
      pick(env?.SMTP_PORT, stored["smtp_port"], proc["SMTP_PORT"], "587"),
      10
    ),
    secure:
      pick(env?.SMTP_SECURE, stored["smtp_secure"], proc["SMTP_SECURE"], "false") === "true",
    username: pick(
      env?.SMTP_USER,
      stored["smtp_username"],
      proc["SMTP_USER"],
      "admin@alwildan.sch.id"
    ),
    password: pick(env?.SMTP_PASS, stored["smtp_password"], proc["SMTP_PASS"], ""),
    fromName: pick(
      env?.SMTP_FROM_NAME,
      stored["smtp_from_name"],
      proc["SMTP_FROM_NAME"],
      "Al Wildan School Logistics"
    ),
    fromEmail: pick(
      env?.SMTP_FROM_EMAIL,
      stored["smtp_from_email"],
      proc["SMTP_FROM_EMAIL"],
      "logistics@alwildan.sch.id"
    ),
    provider,
    brevoApiKey: pick(env?.BREVO_API_KEY, stored["brevo_api_key"], proc["BREVO_API_KEY"], ""),
    brevoApiUrl: pick(
      env?.BREVO_API_URL,
      stored["brevo_api_url"],
      proc["BREVO_API_URL"],
      DEFAULT_BREVO_API_URL
    ),
  };
}

export async function saveSmtpConfig(
  config: Partial<SmtpConfig> & { brevoApiKey?: string }
): Promise<void> {
  const now = new Date().toISOString();
  const entries: Array<{ key: string; value: string; description: string }> = [
    { key: "smtp_host", value: config.host || "", description: "SMTP Server Host" },
    { key: "smtp_port", value: (config.port || 587).toString(), description: "SMTP Port" },
    { key: "smtp_secure", value: config.secure ? "true" : "false", description: "Use SSL/TLS" },
    { key: "smtp_username", value: config.username || "", description: "SMTP Username" },
    { key: "smtp_from_name", value: config.fromName || "Al Wildan School Logistics", description: "Sender Name" },
    { key: "smtp_from_email", value: config.fromEmail || "logistics@alwildan.sch.id", description: "Sender Email" },
  ];

  if (config.password) {
    entries.push({ key: "smtp_password", value: config.password, description: "SMTP Password" });
  }
  if (config.provider === "auto" || config.provider === "brevo" || config.provider === "smtp") {
    entries.push({ key: "email_provider", value: config.provider, description: "Email Provider (auto|brevo|smtp)" });
  }
  if (config.brevoApiKey) {
    entries.push({ key: "brevo_api_key", value: config.brevoApiKey, description: "Brevo HTTP API Key" });
  }
  if (config.brevoApiUrl) {
    entries.push({ key: "brevo_api_url", value: config.brevoApiUrl, description: "Brevo HTTP API URL" });
  }

  for (const entry of entries) {
    await db
      .insert(systemSettings)
      .values({ ...entry, updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: entry.value, updatedAt: now },
      });
  }
}

export interface ProviderSelection {
  provider: EmailProviderName;
  /** Alasan simulasi (hanya terisi bila provider = simulated). */
  simulatedReason?: string;
}

/** Murni dan bisa di-unit-test: pilih transport tanpa mengirim apa pun. */
export function selectProviderName(
  config: ResolvedEmailConfig,
  runtimeIsBun: boolean
): ProviderSelection {
  const brevoReady = config.brevoApiKey.length > 0;
  const smtpReady =
    config.smtpHost.length > 0 &&
    config.smtpUser.length > 0 &&
    config.smtpPassword.length > 0;

  if (config.providerSetting === "brevo") {
    return brevoReady
      ? { provider: "brevo" }
      : { provider: "simulated", simulatedReason: "API key Brevo belum diisi." };
  }

  if (config.providerSetting === "smtp") {
    if (!runtimeIsBun) {
      return {
        provider: "simulated",
        simulatedReason: "SMTP tidak didukung di Cloudflare Workers (tanpa koneksi TCP). Pilih provider API HTTP.",
      };
    }
    return smtpReady
      ? { provider: "smtp" }
      : { provider: "simulated", simulatedReason: "Kredensial SMTP (host/username/password) belum lengkap." };
  }

  // auto
  if (runtimeIsBun) {
    if (smtpReady) return { provider: "smtp" };
    if (brevoReady) return { provider: "brevo" };
    return {
      provider: "simulated",
      simulatedReason: "Belum ada kredensial SMTP maupun API key Brevo.",
    };
  }
  if (brevoReady) return { provider: "brevo" };
  return {
    provider: "simulated",
    simulatedReason: "API key Brevo belum diisi untuk runtime Workers.",
  };
}

export async function sendEmailNotification(
  options: EmailSendOptions,
  env?: EmailRuntimeEnv
): Promise<EmailSendResult> {
  const config = await getSmtpConfig(env);
  const resolved: ResolvedEmailConfig = {
    providerSetting: config.provider,
    brevoApiKey: config.brevoApiKey || "",
    brevoApiUrl: config.brevoApiUrl,
    smtpHost: config.host,
    smtpPort: config.port,
    smtpSecure: config.secure,
    smtpUser: config.username,
    smtpPassword: config.password || "",
    fromName: config.fromName,
    fromEmail: config.fromEmail,
  };
  const selection = selectProviderName(resolved, isBunRuntime());

  if (selection.provider === "simulated") {
    console.log(
      `[Email Simulated] To: ${options.to} | Subject: ${options.subject} | Alasan: ${selection.simulatedReason}`
    );
    return {
      success: true,
      provider: "simulated",
      simulated: true,
      messageId: `sim-${Date.now()}`,
      error: selection.simulatedReason,
    };
  }

  try {
    const provider: EmailProvider = selection.provider === "brevo" ? new BrevoHttpProvider(resolved) : new SmtpProvider(resolved);
    const messageId = await provider.send(options, { name: resolved.fromName, email: resolved.fromEmail });
    return { success: true, provider: selection.provider, simulated: false, messageId };
  } catch (err: any) {
    const message = err?.message || "Pengiriman email gagal tanpa pesan provider.";
    console.error(`[Email Failed via ${selection.provider}] To: ${options.to} | ${message}`);
    return { success: false, provider: selection.provider, simulated: false, error: message };
  }
}
