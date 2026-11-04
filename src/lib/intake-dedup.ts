/**
 * Helper murni untuk menghitung dan memformat jumlah data unik vs duplikat
 * pada alur import masal (buku, murid, dll).
 */

export interface IntakeDedupMetrics {
  rawReadCount: number;
  uniqueCount: number;
  duplicateCount: number;
  skippedInvalidCount?: number;
}

/**
 * Menghitung metrik deduplikasi dengan memisahkan duplikat dari baris yang cacat/dilewati (skipped).
 *
 * Rumus:
 * - duplicateCount = max(0, rawReadCount - (uniqueCount + skippedInvalidCount))
 * Jika rawReadCount belum tersedia atau bernilai 0, duplicateCount = 0.
 */
export function calculateDedupMetrics(
  rawReadCount: number | undefined,
  uniqueCount: number,
  skippedInvalidCount: number = 0
): IntakeDedupMetrics {
  const raw = typeof rawReadCount === "number" && rawReadCount > 0 ? rawReadCount : uniqueCount;
  const nonDuplicateBaseline = uniqueCount + skippedInvalidCount;
  const duplicateCount = raw > nonDuplicateBaseline ? raw - nonDuplicateBaseline : 0;

  return {
    rawReadCount: raw,
    uniqueCount,
    duplicateCount,
    skippedInvalidCount,
  };
}
