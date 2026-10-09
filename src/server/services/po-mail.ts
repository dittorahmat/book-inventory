import type { EmailRuntimeEnv, EmailSendResult } from "./email/types";
import { sendEmailNotification } from "./email/factory";

export interface PoMailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Seam pengiriman email PO (internal, dimiliki modul po-lifecycle).
 * Dua adapter: nyata (via factory email) vs in-memory (rekam kiriman, tanpa jaringan).
 */
export interface PoMailSender {
  readonly name: string;
  send(request: PoMailRequest): Promise<EmailSendResult>;
}

/** Adapter nyata: Brevo/SMTP/simulasi sesuai env, dipakai route production. */
export class RealPoMailSender implements PoMailSender {
  readonly name = "real";
  constructor(private readonly env?: EmailRuntimeEnv) {}

  send(request: PoMailRequest): Promise<EmailSendResult> {
    return sendEmailNotification(
      { to: request.to, subject: request.subject, html: request.html, text: request.text },
      this.env
    );
  }
}

/** Adapter in-memory untuk test: tanpa fetch/env/storage mock, kegagalan dapat diinjeksi sekali. */
export class InMemoryPoMailSender implements PoMailSender {
  readonly name = "in-memory";
  readonly sent: PoMailRequest[] = [];
  private failNextMessage: string | null;

  constructor(opts?: { failNext?: string }) {
    this.failNextMessage = opts?.failNext ?? null;
  }

  failOnce(message: string): void {
    this.failNextMessage = message;
  }

  async send(request: PoMailRequest): Promise<EmailSendResult> {
    if (this.failNextMessage) {
      const error = this.failNextMessage;
      this.failNextMessage = null;
      return { success: false, provider: "brevo", simulated: false, error };
    }
    this.sent.push(request);
    return { success: true, provider: "brevo", simulated: false, messageId: `mem-${this.sent.length}` };
  }
}
