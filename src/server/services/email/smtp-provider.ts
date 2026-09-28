import type {
  EmailProvider,
  EmailSendOptions,
  ResolvedEmailConfig,
} from "./types";

/**
 * Transport SMTP via Nodemailer — hanya untuk Bun/VPS.
 * Nodemailer diimpor dinamis agar tidak ikut ke bundle Cloudflare Workers.
 */
export class SmtpProvider implements EmailProvider {
  readonly name = "smtp" as const;

  constructor(private config: ResolvedEmailConfig) {}

  async send(
    opts: EmailSendOptions,
    from: { name: string; email: string }
  ): Promise<string> {
    const { default: nodemailer } = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      auth: {
        user: this.config.smtpUser,
        pass: this.config.smtpPassword,
      },
    });

    try {
      const info = await transporter.sendMail({
        from: `"${from.name}" <${from.email}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        ...(opts.text ? { text: opts.text } : {}),
      });
      return info.messageId || `smtp-${Date.now()}`;
    } catch (err: any) {
      throw new Error(
        `SMTP ${this.config.smtpHost}:${this.config.smtpPort} gagal mengirim: ${err?.message || err}`
      );
    }
  }
}
