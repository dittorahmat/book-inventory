/**
 * Kanonik rupiah + total snapshot (dipakai frontend + backend).
 * Aturan pemilihan di seam ini:
 * - `calcHeaderTotal` → total snapshot × qty (transfer/shipment, order publik).
 * - `calcPoHeader` (dari lib/book-pricing) → kotor/diskon/netto PO.
 * - `formatRupiah` → satu-satunya presentasi rupiah di view (jangan hand-roll toLocaleString).
 * - `formatCount` → satu-satunya presentasi angka cacah di view.
 */
import { effectiveSellPrice } from "./book-pricing";

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

export type ReceiptCondition = "good" | "damaged" | "missing";

export interface PricedTransferItem {
  id: string;
  book?: { price?: number | null; sellPrice?: number | null } | null;
}

export interface PricedTransferBundle {
  id: string;
  packagePrice?: number | null;
}

/** Total optimistik seleksi satuan transfer (satu-satunya pemilik aturan ini di klien). */
export function calcTransferLooseTotal(selectedIds: string[], items: PricedTransferItem[]): number {
  const byId = new Map(items.map((i) => [i.id, i]));
  return calcHeaderTotal(
    selectedIds.map((id) => ({ unitPriceSnapshot: effectiveSellPrice(byId.get(id)?.book ?? {}), quantity: 1 }))
  );
}

/** Total optimistik seleksi bundel transfer (satu-satunya pemilik aturan ini di klien). */
export function calcTransferPackageTotal(selectedIds: string[], bundles: PricedTransferBundle[]): number {
  const byId = new Map(bundles.map((b) => [b.id, b]));
  return calcHeaderTotal(selectedIds.map((id) => ({ unitPriceSnapshot: byId.get(id)?.packagePrice || 0, quantity: 1 })));
}

export interface CreateShipmentInput {
  fromSchoolId: string;
  toSchoolId: string;
  bookItemIds: string[];
  packageItemIds: string[];
  reason?: string;
  instant?: boolean;
}

export interface CreateShipmentPayload {
  fromSchoolId: string;
  toSchoolId: string;
  bookItemIds: string[];
  packageItemIds: string[];
  reason?: string;
  notes: string;
  instant: boolean;
}

/** Perakitan payload create-shipment yang murni (tanpa fetch, tanpa state). */
export function buildCreateShipmentPayload(input: CreateShipmentInput): CreateShipmentPayload {
  if (input.bookItemIds.length === 0 && input.packageItemIds.length === 0)
    throw new Error("Pilih minimal 1 buku satuan atau 1 bundel paketan");
  const reason = input.reason?.trim() || undefined;
  const instant = input.instant ?? false;
  return {
    fromSchoolId: input.fromSchoolId,
    toSchoolId: input.toSchoolId,
    bookItemIds: input.bookItemIds,
    packageItemIds: input.packageItemIds,
    ...(reason ? { reason } : {}),
    notes: instant ? "Instant stock transfer" : "Scheduled distribution",
    instant,
  };
}

export interface ManifestLine {
  itemType?: string | null;
  bookItemId?: string | null;
  packageItemId?: string | null;
}

export interface ConditionPick {
  bookItemId?: string;
  packageItemId?: string;
  condition: ReceiptCondition;
}

/** Perakitan payload receive-shipment yang murni; pick yang hilang default "good". */
export function buildReceiveShipmentPayload(
  manifest: ManifestLine[],
  loosePicks: Array<{ bookItemId: string; condition: ReceiptCondition }> = [],
  bundlePicks: Array<{ packageItemId: string; condition: ReceiptCondition }> = []
): {
  itemReceipts: Array<{ bookItemId: string; condition: ReceiptCondition }>;
  packageReceipts: Array<{ packageItemId: string; condition: ReceiptCondition }>;
} {
  const looseItems = manifest.filter((item) => item.itemType !== "package" && item.bookItemId);
  const bundleItems = manifest.filter((item) => item.itemType === "package" && item.packageItemId);
  if (looseItems.length === 0 && bundleItems.length === 0) throw new Error("Tidak ada item manifest pada transfer ini");
  const looseById = new Map(loosePicks.map((p) => [p.bookItemId, p.condition]));
  const bundleById = new Map(bundlePicks.map((p) => [p.packageItemId, p.condition]));
  return {
    itemReceipts: looseItems.map((item) => ({
      bookItemId: item.bookItemId as string,
      condition: looseById.get(item.bookItemId as string) ?? "good",
    })),
    packageReceipts: bundleItems.map((item) => ({
      packageItemId: item.packageItemId as string,
      condition: bundleById.get(item.packageItemId as string) ?? "good",
    })),
  };
}
