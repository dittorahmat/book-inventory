// Tipe bersama untuk layer email runtime-agnostik.
// Workers -> Brevo HTTP API (fetch), Bun/VPS -> SMTP (Nodemailer),
// tanpa kredensial -> simulasi eksplisit (tidak pernah klaim terkirim).

export type EmailProviderName = "brevo" | "smtp" | "simulated";
export type EmailProviderSetting = "auto" | "brevo" | "smtp";

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  success: boolean;
  provider: EmailProviderName;
  simulated: boolean;
  messageId?: string;
  error?: string;
}

/** Potongan env yang dibaca layer email (Workers `c.env` / `process.env`). */
export interface EmailRuntimeEnv {
  EMAIL_PROVIDER?: string;
  BREVO_API_KEY?: string;
  BREVO_API_URL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM_NAME?: string;
  SMTP_FROM_EMAIL?: string;
}

export interface EmailProvider {
  readonly name: Exclude<EmailProviderName, "simulated">;
  send(
    opts: EmailSendOptions,
    from: { name: string; email: string }
  ): Promise<string>;
}

export interface ResolvedEmailConfig {
  providerSetting: EmailProviderSetting;
  brevoApiKey: string;
  brevoApiUrl: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromName: string;
  fromEmail: string;
}
