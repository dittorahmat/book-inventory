export interface ValuedLine {
  unitPriceSnapshot: number;
  quantity: number;
}

export interface MixedLineInput {
  itemType: "loose" | "package";
  bookItemId: string | null;
  packageId: string | null;
  packageItemId: string | null;
  quantity: number;
  unitPriceSnapshot: number;
}

export function toInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function calcLineTotal(snapshot: number, quantity: number): number {
  return toInt(snapshot) * Math.max(1, Math.floor(Number(quantity) || 1));
}

export function calcHeaderTotal(lines: ValuedLine[]): number {
  return lines.reduce((sum, l) => sum + calcLineTotal(l.unitPriceSnapshot, l.quantity), 0);
}

export function isValidMixedLine(line: MixedLineInput): boolean {
  if (line.itemType === "loose") {
    return !!line.bookItemId && !line.packageItemId && line.quantity === 1;
  }
  return !line.bookItemId && !!line.packageItemId && !!line.packageId && line.quantity === 1;
}

export function formatRupiah(amount: number): string {
  return `Rp ${toInt(amount).toLocaleString("id-ID")}`;
}
