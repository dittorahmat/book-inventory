import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { systemSettings, users } from "../../db/schema";
import { escapeHtml } from "./email/po-template";
import { sendEmailNotification } from "./email/factory";
import type { EmailRuntimeEnv, EmailSendOptions, EmailSendResult } from "./email/types";

/**
 * Inti alarm produksi D1 (§6 AGENTS.md): hitung sidik temuan, bandingkan dengan
 * alarm terakhir, kirim email ke staf pusat HANYA bila himpunan berubah, lalu
 * simpan sidik. Dipakai bersama alarm sampah data-uji dan alarm drift skema.
 *
 * Cron tidak punya "build merah", jadi satu-satunya cara alarm terlihat adalah
 * pesan ke manusia — dan justru karena itu anti-spam wajib, sebab alarm yang
 * menagih tiap malam akan berhenti dibaca (akar insiden yang sama).
 */

export type AlarmOutcome = "clean" | "unchanged" | "no-recipients" | "notified" | "notify-failed";

export interface AlarmDeps {
  mail?: (options: EmailSendOptions) => Promise<EmailSendResult>;
  env?: EmailRuntimeEnv;
}

export interface AlarmResult {
  count: number;
  recipients: number;
  sent: number;
  outcome: AlarmOutcome;
  errors?: string[];
}

export interface AlarmSpec {
  /** Kunci `system_settings` penyimpan sidik alarm terakhir. */
  key: string;
  subject: (count: number) => string;
  body: (findings: string[]) => string;
}

export const runAlarm = async (
  database: AppDatabase,
  spec: AlarmSpec,
  findings: string[],
  deps?: AlarmDeps
): Promise<AlarmResult> => {
  const signature = [...findings].sort().join("|");
  const [stored]: Array<{ value: string } | undefined> = await database
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, spec.key));

  if (findings.length === 0) {
    // Bersih kembali: buang sidik supaya temuan baru kelak tetap dialarmkan.
    if (stored) await database.delete(systemSettings).where(eq(systemSettings.key, spec.key));
    return { count: 0, recipients: 0, sent: 0, outcome: "clean" };
  }
  if (stored?.value === signature) {
    return { count: findings.length, recipients: 0, sent: 0, outcome: "unchanged" };
  }

  const admins: Array<{ email: string }> = await database
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "central_admin"));
  if (admins.length === 0) {
    return { count: findings.length, recipients: 0, sent: 0, outcome: "no-recipients" };
  }

  const text = spec.body(findings);
  const subject = spec.subject(findings.length);
  const mailer = deps?.mail ?? ((options: EmailSendOptions) => sendEmailNotification(database, options, deps?.env));
  const failures = (
    await Promise.all(
      admins.map(async (admin): Promise<string | null> => {
        try {
          const result = await mailer({ to: admin.email, subject, text, html: `<pre>${escapeHtml(text)}</pre>` });
          return result.success ? null : `ke ${admin.email}: ${result.error ?? "pengiriman gagal tanpa pesan"}`;
        } catch (error) {
          return `ke ${admin.email}: ${error instanceof Error ? error.message : "error tak dikenal"}`;
        }
      })
    )
  ).filter((failure): failure is string => failure !== null);
  const sent = admins.length - failures.length;

  // Sidik disimpan hanya bila minimal satu email terkirim, supaya kegagalan
  // total (mis. Brevo mati) dicoba lagi pada cron berikutnya.
  if (sent === 0) {
    return { count: findings.length, recipients: admins.length, sent, outcome: "notify-failed", errors: failures };
  }
  const now = new Date().toISOString();
  await database
    .insert(systemSettings)
    .values({ key: spec.key, value: signature, description: `Sidik alarm terakhir (${spec.key}).`, updatedAt: now })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value: signature, updatedAt: now } });

  return {
    count: findings.length,
    recipients: admins.length,
    sent,
    outcome: "notified",
    errors: failures.length ? failures : undefined,
  };
};
