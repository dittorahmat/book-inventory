/**
 * Parser & Helper untuk Bulk Upload Resi Logistik Seragam.
 * Format standar: `NIS | NAMA | Resi` (atau format CSV koma).
 */

export interface BulkResiRowInput {
  nis: string;
  name: string;
  resi: string;
}

export function parseBulkResiText(text: string): BulkResiRowInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: BulkResiRowInput[] = [];

  for (const line of lines) {
    const delimiter = line.includes("|") ? "|" : ",";
    const parts = line.split(delimiter).map((p) => p.trim());

    if (parts.length < 3) continue;

    const [nis, name, resi] = parts;

    // Lewati baris header jika memuat kata kunci header
    const lowerNis = nis.toLowerCase();
    if (lowerNis === "nis" || lowerNis.includes("nomor induk") || lowerNis.includes("nama")) {
      continue;
    }

    if (!nis || !resi) continue;

    results.push({
      nis,
      name,
      resi,
    });
  }

  return results;
}
