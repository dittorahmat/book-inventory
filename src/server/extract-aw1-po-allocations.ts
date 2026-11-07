/**
 * Modul Parser Ekstraksi Alokasi Buku Murid AW-1 dari Lembar Estimasi PO
 * Sesuai kesepakatan Issue #322: Mengambil kuantitas khusus AW-1 (INT + MQ) dari 15 jenjang.
 */

export interface Aw1BookAllocationItem {
  jenjang: string;
  title: string;
  quantity: number;
}

function cleanNum(val: unknown): number {
  if (!val) return 0;
  const s = String(val).replace(/\./g, "").replace(/,/g, "").trim();
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Mengekstrak baris kuantitas alokasi murid AW-1 dari satu sheet CSV per jenjang.
 */
export function parsePoSheetAw1Allocation(jenjang: string, csvContent: string): Aw1BookAllocationItem[] {
  const lines = csvContent.split(/\r?\n/);
  const items: Aw1BookAllocationItem[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(",").map((s) => s.trim());
    if (!cols[0] || !/^\d+$/.test(cols[0])) continue;

    const title = cols[1];
    let qty = 0;

    if (jenjang === "PG") {
      // PG: cols[2] adalah AW1
      qty = cleanNum(cols[2]);
    } else if (jenjang === "K1" || jenjang === "K2") {
      // K1 / K2: cols[1] title, cols[2] empty, cols[3] adalah AW-1
      qty = cleanNum(cols[3]);
    } else if (jenjang.startsWith("SD")) {
      if (jenjang === "SD1") {
        // SD1: cols[2] INT, cols[3] MQ
        qty = cleanNum(cols[2]) + cleanNum(cols[3]);
      } else {
        // SD2-SD6: cols[1] title, cols[2] empty, cols[3] INT, cols[4] MQ
        qty = cleanNum(cols[3]) + cleanNum(cols[4]);
      }
    } else if (jenjang.startsWith("SMP")) {
      if (jenjang === "SMP7") {
        // SMP7: cols[2] AE, cols[3] ME, cols[4] MQ
        qty = cleanNum(cols[2]) + cleanNum(cols[3]) + cleanNum(cols[4]);
      } else {
        // SMP8-9: cols[1] title, cols[2] empty, cols[3] AE, cols[4] ME, cols[5] MQ
        qty = cleanNum(cols[3]) + cleanNum(cols[4]) + cleanNum(cols[5]);
      }
    } else if (jenjang.startsWith("SMA")) {
      if (jenjang === "SMA10") {
        // SMA10: cols[2..9] adalah AE/DI/ME/MQ x IPA/IPS (8 kolom pertama AW-1)
        for (let c = 2; c <= 9; c++) qty += cleanNum(cols[c]);
      } else {
        // SMA11-12: cols[1] title, cols[2] empty, cols[3..10] adalah 8 kolom AW-1
        for (let c = 3; c <= 10; c++) qty += cleanNum(cols[c]);
      }
    }

    if (title && qty > 0) {
      items.push({ jenjang, title, quantity: qty });
    }
  }

  return items;
}

/**
 * Mengagregasi total kuantitas per judul buku.
 */
export function aggregateAw1Allocations(items: Aw1BookAllocationItem[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const item of items) {
    const normTitle = item.title.trim();
    result.set(normTitle, (result.get(normTitle) || 0) + item.quantity);
  }
  return result;
}
