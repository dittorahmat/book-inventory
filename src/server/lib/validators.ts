import { z } from "zod";

/** Kanonik identifier longgar: kompatibel slug demo (school-alw-1) maupun UUID v4. Jangan pakai z.string().uuid(). */
export const idSchema = z.string().min(1);

export const academicYearSchema = z.string().regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran wajib YYYY/YYYY");

/** Maksimal ukuran karakter string base64 untuk upload bukti dokumen (~5MB payload batas memori worker). */
export const MAX_BASE64_UPLOAD_CHARS = 7_000_000;
export const base64UploadSchema = z
  .string()
  .max(MAX_BASE64_UPLOAD_CHARS, "Ukuran file bukti maksimal 5MB")
  .optional();

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
  /^sch-\d+$/i,
  /^sch-[a-z0-9]+$/i,
];

/** True bila nilai tampak seperti id/nama baris uji — wajib gagal di export/seed production. */
export const isTestSeedValue = (value: unknown): boolean =>
  typeof value === "string" && (TEST_SEED_PATTERNS.some((re) => re.test(value)) || value.trim() === "S");

/**
 * Helper kanonik sanitasi parameter pagination server-side (page & limit).
 * Membatasi rentang page >= 1 dan 1 <= limit <= maxLimit (default 100).
 */
export function parsePaginationParams(
  query: { page?: unknown; limit?: unknown },
  defaultLimit = 50,
  maxLimit = 100
): { page: number; limit: number; offset: number } {
  const parsedPage = Number(query.page);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;

  const parsedLimit = Number(query.limit);
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit >= 1
      ? Math.min(Math.floor(parsedLimit), maxLimit)
      : defaultLimit;

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}
