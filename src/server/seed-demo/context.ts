import type { AppDatabase } from "../../db";

/** Konteks seed: satu instance DB + timestamp yang dipakai seluruh modul. */
export interface SeedContext {
  db: AppDatabase;
  now: string;
}

/**
 * Bukti dokumen demo berupa SVG data URL: bisa dibuka di layar staf tanpa
 * bergantung pada storage eksternal (R2/memory) yang hilang saat restart.
 */
export const demoProofUrl = (label: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="100%" height="100%" fill="#f8fafc"/><rect x="16" y="16" width="608" height="368" fill="none" stroke="#94a3b8" stroke-width="4" stroke-dasharray="12 8"/><text x="320" y="190" font-family="sans-serif" font-size="28" fill="#0f172a" text-anchor="middle">Bukti Demo</text><text x="320" y="234" font-family="sans-serif" font-size="20" fill="#475569" text-anchor="middle">${label}</text></svg>`
  )}`;
