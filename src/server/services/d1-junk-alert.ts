import { schools } from "../../db/schema";
import type { AppDatabase } from "../../db";
import { runAlarm, type AlarmDeps, type AlarmResult, type AlarmSpec } from "./d1-alarm";
import { findJunkSchools, type JunkSchoolRow } from "./d1-junk-scan";

/**
 * Alarm sampah data-uji di production D1 (vektor insiden "175 sekolah sampah",
 * Okt 2026). Dipicu Cron Trigger `scheduled` Worker lewat binding D1 — nol
 * kredensial tambahan, beda dari alarm manual `scripts/check-d1-junk.ts`.
 * Sidik/anti-spam/pengiriman email dipegang `d1-alarm.ts`.
 */

/** Kunci `system_settings` penyimpan sidik alarm terakhir. */
export const JUNK_ALERT_SIGNATURE_KEY = "d1_junk_alert_signature";

/** Sekolah pola-uji yang benar-benar ada di production sekarang. */
export const scanJunkSchools = async (database: AppDatabase): Promise<JunkSchoolRow[]> => {
  // `schools` tabel master kecil (belasan baris) — satu baca penuh pada cron
  // harian disengaja; larangan §11 menyasar endpoint pencarian di request path.
  // Keputusan tetap tunggal di `findJunkSchools`.
  const rows: JunkSchoolRow[] = await database.select({ id: schools.id, name: schools.name }).from(schools);
  return findJunkSchools(rows);
};

const JUNK_SPEC: AlarmSpec = {
  key: JUNK_ALERT_SIGNATURE_KEY,
  subject: (count) => `ALARM: ${count} sekolah pola-uji di production D1`,
  body: (findings) =>
    [
      `${findings.length} baris sekolah di production cocok dengan pola data uji:`,
      ...findings.slice(0, 20).map((line) => `- ${line}`),
      ...(findings.length > 20 ? [`... dan ${findings.length - 20} baris lain`] : []),
      "",
      "Tindakan (AGENTS.md §6): sebelum DELETE massal wajib verifikasi target DB,",
      "SELECT COUNT(*) + contoh baris dengan predikat sama, dan pastikan 0 relasi anak",
      "(students, student_book_orders, book_items, package_items, transfer_shipments,",
      "purchase_orders, users). Jalankan di dev lokal bila memungkinkan.",
    ].join("\n"),
};

/** Jalankan alarm sampah: pindai, kirim email bila himpunan berubah, catat sidik. */
export const alertJunkSchools = async (database: AppDatabase, deps?: AlarmDeps): Promise<AlarmResult> => {
  const findings = (await scanJunkSchools(database)).map((row) => `${String(row.id)} — ${String(row.name)}`);
  return runAlarm(database, JUNK_SPEC, findings, deps);
};
