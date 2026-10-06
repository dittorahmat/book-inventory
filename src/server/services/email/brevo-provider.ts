import type {
  EmailProvider,
  EmailSendOptions,
  ResolvedEmailConfig,
} from "./types";
import { DEFAULT_BREVO_API_URL } from "./types";

/** Transport Brevo via HTTP API — satu-satunya jalur yang bisa dipakai di Workers. */
export class BrevoHttpProvider implements EmailProvider {
  readonly name = "brevo" as const;

  constructor(private config: ResolvedEmailConfig) {}

  async send(
    opts: EmailSendOptions,
    from: { name: string; email: string }
  ): Promise<string> {
    const res = await fetch(this.config.brevoApiUrl || DEFAULT_BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.config.brevoApiKey,
      },
      body: JSON.stringify({
        sender: { name: from.name, email: from.email },
        to: [{ email: opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
        ...(opts.text ? { textContent: opts.text } : {}),
      }),
    });

    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) {
      const detail =
        payload?.message || payload?.code || `HTTP ${res.status}`;
      throw new Error(
        `Brevo menolak pengiriman (${res.status}): ${detail}. ` +
          `Pastikan API key benar dan alamat pengirim sudah terverifikasi di dashboard Brevo.`
      );
    }

    return payload?.messageId || `brevo-${Date.now()}`;
  }
}
