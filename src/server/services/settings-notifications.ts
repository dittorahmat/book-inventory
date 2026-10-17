import type { AppDatabase } from "../../db";
import { getSmtpConfig, saveSmtpConfig, sendEmailNotification } from "./email/factory";
import type { EmailRuntimeEnv } from "./email/types";
import {
  MetaWhatsAppSender,
  getMetaWhatsAppConfig,
  saveMetaWhatsAppConfig,
} from "./whatsapp";

/** Masker kanonik rahasia: tak satu pun secret mentah keluar via GET. */
export const MASKED_SECRET = "********";

export interface SmtpSaveInput {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  fromName: string;
  fromEmail: string;
  emailProvider: "auto" | "brevo" | "smtp";
  brevoApiKey?: string;
  brevoApiUrl?: string;
}

export interface MetaSaveInput {
  phoneNumberId: string;
  accessToken?: string;
  isEnabled: boolean;
}

/**
 * Satu-satunya seam pengaturan notifikasi: masking + preservasi
 * "********" + test-send SMTP/WA/Meta tinggal di balik satu interface.
 * Route pengaturan hanya adaptor tipis (otorisasi + validasi zod).
 */
export const getSmtpView = async (database: AppDatabase, env?: EmailRuntimeEnv) => {
  const config = await getSmtpConfig(database, env);
  const smtpConfigured = Boolean(config.password);
  const brevoConfigured = Boolean(config.brevoApiKey);
  return {
    ...config,
    password: smtpConfigured ? MASKED_SECRET : "",
    brevoApiKey: brevoConfigured ? MASKED_SECRET : "",
    isConfigured: smtpConfigured || brevoConfigured,
    smtpConfigured,
    brevoConfigured,
  };
};

export const saveSmtp = (database: AppDatabase, input: SmtpSaveInput) =>
  saveSmtpConfig(database, {
    ...input,
    provider: input.emailProvider,
    password: input.password && input.password !== MASKED_SECRET ? input.password : undefined,
    brevoApiKey: input.brevoApiKey && input.brevoApiKey !== MASKED_SECRET ? input.brevoApiKey : undefined,
  });

export const testSmtp = async (database: AppDatabase, recipientEmail: string, env?: EmailRuntimeEnv) => {
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const stamp = shifted.toISOString().slice(0, 16).replace("T", " ");
  return sendEmailNotification(
    database,
    {
      to: recipientEmail,
      subject: "Uji Coba Notifikasi Email Al Wildan School Logistics",
      html: `
      <div style="font-family: sans-serif; padding: 20px; color: #050505;">
        <h2>Uji Coba Konfigurasi Email Berhasil</h2>
        <p>Sistem inventaris dan pemesanan buku sekolah Al Wildan telah terhubung dengan layanan email.</p>
        <p style="color: #65676B; font-size: 12px;">Waktu pengiriman: ${stamp} WIB</p>
      </div>
    `,
    },
    env
  );
};

export const getMetaView = async (database: AppDatabase) => {
  const config = await getMetaWhatsAppConfig(database);
  return {
    ...config,
    accessToken: config.accessToken ? MASKED_SECRET : "",
    isConfigured: Boolean(config.phoneNumberId),
  };
};

export const saveMeta = async (database: AppDatabase, input: MetaSaveInput) => {
  const existing = await getMetaWhatsAppConfig(database);
  await saveMetaWhatsAppConfig(database, {
    ...input,
    accessToken: input.accessToken === MASKED_SECRET ? existing.accessToken : (input.accessToken ?? ""),
  });
};

export const testMeta = (database: AppDatabase, phone: string, message: string) =>
  new MetaWhatsAppSender(database).send({ to: phone, text: message });
