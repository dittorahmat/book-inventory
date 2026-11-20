/**
 * Canonical Cloudflare D1 Target Database Configurations (§0.30)
 * Mengelola daftar database D1 remote dan environment wrangler pendukungnya
 * agar tidak terjadi hardcoded terpisah (mencegah Shotgun Surgery).
 */

export interface D1DatabaseTarget {
  name: string;
  env?: string;
  description: string;
}

export const CANONICAL_D1_TARGETS: readonly D1DatabaseTarget[] = [
  {
    name: "book-inventory-db",
    description: "Database remote produksi utama",
  },
  {
    name: "inv-aw-db",
    env: "inv-aw",
    description: "Database remote clone testing (lingkungan inv-aw)",
  },
] as const;

/**
 * Resolusi database target D1 untuk pengujian drift atau eksekusi CLI.
 * Mendukung override nama via environment variable `D1_DATABASE` atau `D1_ENV`.
 */
export function resolveD1Targets(
  customDb?: string,
  customEnv?: string
): D1DatabaseTarget[] {
  if (customDb) {
    const matched = CANONICAL_D1_TARGETS.find((t) => t.name === customDb);
    return [
      {
        name: customDb,
        env: customEnv ?? matched?.env,
        description: matched?.description ?? "Database remote kustom",
      },
    ];
  }

  return [...CANONICAL_D1_TARGETS];
}
