export function toIntRupiah(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function formatRupiah(amount: unknown): string {
  return `Rp ${toIntRupiah(amount).toLocaleString("id-ID")}`;
}

export function calcLineTotal(snapshot: unknown, quantity: unknown): number {
  return toIntRupiah(snapshot) * Math.max(1, Math.floor(Number(quantity) || 1));
}

export function calcHeaderTotal(lines: Array<{ unitPriceSnapshot: unknown; quantity: unknown }>): number {
  return lines.reduce((sum, l) => sum + calcLineTotal(l.unitPriceSnapshot, l.quantity), 0);
}
