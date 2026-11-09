/**
 * scripts/lib/sql-chunk-builder.ts
 *
 * Helper bersama untuk memformat dan memecah pernyataan SQL batch
 * dengan batas ukuran chunk aman (maksimal 10 baris per INSERT) sesuai aturan Cloudflare D1 §10.
 */

export function escapeSql(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
