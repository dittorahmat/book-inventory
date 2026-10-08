/**
 * Kanonik rupiah + total snapshot (dipakai frontend + backend).
 * Aturan pemilihan di seam ini:
 * - `calcHeaderTotal` → total snapshot × qty (transfer/shipment, order publik).
 * - `calcPoHeader` (dari lib/book-pricing) → kotor/diskon/netto PO.
 * - `formatRupiah` → satu-satunya presentasi rupiah di view (jangan hand-roll toLocaleString).
 * - `formatCount` → satu-satunya presentasi angka cacah di view.
 */
export function toIntRupiah(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function formatRupiah(amount: unknown): string {
  return `Rp ${toIntRupiah(amount).toLocaleString("id-ID")}`;
}

/** Presentasi angka cacah (eksemplar, pesanan) — pasangan formatRupiah untuk non-rupiah. */
export function formatCount(count: unknown): string {
  const n = typeof count === "number" ? count : Number(count);
  return (Number.isFinite(n) ? Math.floor(n) : 0).toLocaleString("id-ID");
}

export function calcLineTotal(snapshot: unknown, quantity: unknown): number {
  return toIntRupiah(snapshot) * Math.max(1, Math.floor(Number(quantity) || 1));
}

export function calcHeaderTotal(lines: Array<{ unitPriceSnapshot: unknown; quantity: unknown }>): number {
  return lines.reduce((sum, l) => sum + calcLineTotal(l.unitPriceSnapshot, l.quantity), 0);
}
