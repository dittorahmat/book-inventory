import { z } from "zod";

/** Kanonik identifier longgar: kompatibel slug demo (school-alw-1) maupun UUID v4. Jangan pakai z.string().uuid(). */
export const idSchema = z.string().min(1);

export const academicYearSchema = z.string().regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran wajib YYYY/YYYY");

/**
 * Sidik data uji (§6 AGENTS.md): id/nama baris yang dibuat skenario test
 * otomatis atau QA manual — pola yang terbukti bocor ke D1 production
 * (insiden 175 sekolah sampah, Okt 2026). Satu-satunya sumber kebenaran
 * pola ini: dipakai export-d1-seed (fail-closed), check:d1-junk (alarm
 * remote), dan skrip cleanup. `\btest\b` presisi: "TEST-DSH"/"Empty test"
 * cocok, "latest"/"contest" tidak.
 */
const TEST_SEED_PATTERNS = [
  /\btest\b/i,
  /^school-(empty|iso|lock|nis|sch|t\d+|tm|vol|sh|wh)-/i,
  /^SUP-WF-/,
  /^sekolah school-/i,
];

/** True bila nilai tampak seperti id/nama baris uji — wajib gagal di export/seed production. */
export const isTestSeedValue = (value: unknown): boolean =>
  typeof value === "string" && TEST_SEED_PATTERNS.some((re) => re.test(value));
