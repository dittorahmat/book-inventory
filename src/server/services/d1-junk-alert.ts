import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { schools, systemSettings, users } from "../../db/schema";
import { findJunkSchools, type JunkSchoolRow } from "./d1-junk-scan";
import { escapeHtml } from "./email/po-template";
import { sendEmailNotification } from "./email/factory";
import type { EmailRuntimeEnv, EmailSendOptions, EmailSendResult } from "./email/types";

/**
 * Alarm sampah data-uji di production D1, dijalankan **Cron Trigger** Worker
 * (§6 AGENTS.md; vektor insiden "175 sekolah sampah", Okt 2026). Nol kredensial:
 * query langsung lewat binding D1, bukan via wrangler — beda dari alarm manual
 * `scripts/check-d1-junk.ts` yang butuh CF token.
 *
 * Alasan alarm ini ada: cron tidak punya "build merah", jadi satu-satunya cara
 * alarm terlihat adalah mengirim pesan ke manusia. Recipient = seluruh
 * `central_admin` (tabel `users` tidak menyimpan nomor HP, jadi email saja).
 * Anti-spam: alarm hanya dikirim saat himpunan sampah **berubah** dari alarm
 * terakhir (sidik di `system_settings`), sehingga tidak jadi noise harian yang
 * akhirnya diabaikan — akar masalah insiden yang sama.
 */

/** Kunci `system_settings` penyimpan sidik alarm terakhir. */
export const JUNK_ALERT_SIGNATURE_KEY = "d1_junk_alert_signature";

export interface JunkAlertDeps {
  mail?: (options: EmailSendOptions) => Promise<EmailSendResult>;
  env?: EmailRuntimeEnv;
}

export interface JunkAlertResult {
  junkCount: number;
  recipients: number;
  sent: number;
  /** Terisi bila alarm dilewati (production bersih / sampah tak berubah / tanpa recipient). */
  skipped?: string;
  errors?: string[];
}

/** Sekolah pola-uji yang benar-benar ada di production sekarang. */
export const scanJunkSchools = async (database: AppDatabase): Promise<JunkSchoolRow[]> => {
  // `schools` adalah tabel master kecil (belasan baris) — satu baca penuh pada
  // cron harian disengaja; larangan §11 menyasar endpoint pencarian di request
  // path, bukan alarm batch. Keputusan tetap tunggal di `findJunkSchools`.
  const rows: JunkSchoolRow[] = await database.select({ id: schools.id, name: schools.name }).from(schools);
  return findJunkSchools(rows);
};

/** Isi email alarm: daftar sekolah sampah + instruksi pembersihan §6. */
const buildJunkAlertEmail = (junk: JunkSchoolRow[]): { subject: string; text: string } => ({
  subject: `ALARM: ${junk.length} sekolah pola-uji di production D1`,
  text: [
    `${junk.length} baris sekolah di production cocok dengan pola data uji:`,
    ...junk.slice(0, 20).map((row) => `- ${String(row.id)} — ${String(row.name)}`),
    ...(junk.length > 20 ? [`... dan ${junk.length - 20} baris lain`] : []),
    "",
    "Tindakan (AGENTS.md §6): sebelum DELETE massal wajib verifikasi target DB,",
    "SELECT COUNT(*) + contoh baris dengan predikat sama, dan pastikan 0 relasi anak",
    "(students, student_book_orders, book_items, package_items, transfer_shipments,",
    "purchase_orders, users). Jalankan di dev lokal bila memungkinkan.",
  ].join("\n"),
});

/**
 * Jalankan alarm: pindai sampah, kirim email ke `central_admin` bila himpunan
 * berubah, catat sidiknya. Tidak pernah melempar — hasil selalu terstruktur
 * supaya handler cron bisa mencatatnya (satu-satunya kanal bila email gagal).
 */
export const alertJunkSchools = async (
  database: AppDatabase,
  deps?: JunkAlertDeps
): Promise<JunkAlertResult> => {
  const junk = await scanJunkSchools(database);
  const signature = junk.map((row) => String(row.id)).sort().join(",");
  const [stored]: Array<{ value: string } | undefined> = await database
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, JUNK_ALERT_SIGNATURE_KEY));

  if (junk.length === 0) {
    if (stored) await database.delete(systemSettings).where(eq(systemSettings.key, JUNK_ALERT_SIGNATURE_KEY));
    return { junkCount: 0, recipients: 0, sent: 0, skipped: "production bersih" };
  }
  if (stored?.value === signature) {
    return { junkCount: junk.length, recipients: 0, sent: 0, skipped: "sampah sama dengan alarm terakhir" };
  }

  const admins: Array<{ email: string }> = await database
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "central_admin"));
  if (admins.length === 0) {
    return { junkCount: junk.length, recipients: 0, sent: 0, skipped: "tidak ada central_admin ber-email" };
  }

  const { subject, text } = buildJunkAlertEmail(junk);
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

  // Simpan sidik hanya bila minimal satu email benar-benar terkirim, supaya
  // kegagalan total (mis. Brevo mati) dicoba lagi pada cron berikutnya.
  if (sent > 0) {
    const now = new Date().toISOString();
    await database
      .insert(systemSettings)
      .values({
        key: JUNK_ALERT_SIGNATURE_KEY,
        value: signature,
        description: "Sidik alarm terakhir sampah data-uji production (cron D1).",
        updatedAt: now,
      })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: signature, updatedAt: now } });
  }

  return { junkCount: junk.length, recipients: admins.length, sent, errors: failures.length ? failures : undefined };
};
