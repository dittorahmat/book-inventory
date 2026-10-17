import type { AppDatabase } from "../../db";
import { runAlarm, type AlarmDeps, type AlarmResult, type AlarmSpec } from "./d1-alarm";
import { scanDrift } from "../lib/d1-drift-scan";

/**
 * Alarm drift skema D1 (kelas insiden §1: migrasi tak teraplikasi ke remote →
 * endpoint 500 padahal test lokal hijau). Sebelumnya gate `check:d1-drift`
 * hanya bisa dijalankan MANUAL karena butuh kredensial Cloudflare; alarm ini
 * menutup celah itu lewat binding D1 pada Cron Trigger — nol kredensial.
 * Sidik/anti-spam/pengiriman email dipegang `d1-alarm.ts`.
 */

/** Kunci `system_settings` penyimpan sidik alarm terakhir. */
export const DRIFT_ALERT_SIGNATURE_KEY = "d1_drift_alert_signature";

const DRIFT_SPEC: AlarmSpec = {
  key: DRIFT_ALERT_SIGNATURE_KEY,
  subject: (count) => `ALARM: ${count} drift skema di production D1`,
  body: (findings) =>
    [
      `${findings.length} perbedaan antara schema.ts dan production D1:`,
      ...findings.slice(0, 20).map((line) => `- ${line}`),
      ...(findings.length > 20 ? [`... dan ${findings.length - 20} temuan lain`] : []),
      "",
      "Endpoint yang menyentuh tabel/kolom ini akan 500 (no such table / no such column).",
      "Terapkan migrasi drizzle/ yang tertinggal ke remote (AGENTS.md §1), lalu buktikan:",
      "bun run check:d1-drift",
    ].join("\n"),
};

/** Jalankan alarm drift: bandingkan schema ORM dengan D1 live, email bila berubah. */
export const alertDrift = async (database: AppDatabase, deps?: AlarmDeps): Promise<AlarmResult> =>
  runAlarm(database, DRIFT_SPEC, await scanDrift(database), deps);
