import type { AppDatabase } from "../db";
import { readSettingsMap } from "../server/services/settings-map";

export const LOW_STOCK_THRESHOLD_KEYS = {
  BOOK: "low_stock_threshold_book",
  BOOK_PACKAGE: "low_stock_threshold_book_package",
  UNIFORM_VARIANT: "low_stock_threshold_uniform_variant",
  UNIFORM_PACKAGE: "low_stock_threshold_uniform_package",
} as const;

export const DEFAULT_LOW_STOCK_THRESHOLDS = {
  [LOW_STOCK_THRESHOLD_KEYS.BOOK]: 10,
  [LOW_STOCK_THRESHOLD_KEYS.BOOK_PACKAGE]: 5,
  [LOW_STOCK_THRESHOLD_KEYS.UNIFORM_VARIANT]: 5,
  [LOW_STOCK_THRESHOLD_KEYS.UNIFORM_PACKAGE]: 5,
} as const;

export interface LowStockThresholdSettings {
  book: number;
  bookPackage: number;
  uniformVariant: number;
  uniformPackage: number;
}

export type LowStockItemKind = "book" | "book_package" | "uniform_variant" | "uniform_package";

/**
 * Membaca pengaturan threshold low stock dari system_settings dengan fallback default.
 */
export async function getLowStockThresholdSettings(
  database: AppDatabase
): Promise<LowStockThresholdSettings> {
  const map = await readSettingsMap(database);

  const parseOrFallback = (key: string, fallback: number): number => {
    const raw = map[key];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };

  return {
    book: parseOrFallback(
      LOW_STOCK_THRESHOLD_KEYS.BOOK,
      DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.BOOK]
    ),
    bookPackage: parseOrFallback(
      LOW_STOCK_THRESHOLD_KEYS.BOOK_PACKAGE,
      DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.BOOK_PACKAGE]
    ),
    uniformVariant: parseOrFallback(
      LOW_STOCK_THRESHOLD_KEYS.UNIFORM_VARIANT,
      DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.UNIFORM_VARIANT]
    ),
    uniformPackage: parseOrFallback(
      LOW_STOCK_THRESHOLD_KEYS.UNIFORM_PACKAGE,
      DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.UNIFORM_PACKAGE]
    ),
  };
}

const KIND_THRESHOLD_KEY_MAP: Record<LowStockItemKind, keyof LowStockThresholdSettings> = {
  book: "book",
  book_package: "bookPackage",
  uniform_variant: "uniformVariant",
  uniform_package: "uniformPackage",
};

const KIND_DEFAULT_MAP: Record<LowStockItemKind, number> = {
  book: DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.BOOK],
  book_package: DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.BOOK_PACKAGE],
  uniform_variant: DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.UNIFORM_VARIANT],
  uniform_package: DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.UNIFORM_PACKAGE],
};

/**
 * Menentukan apakah kuantitas stok tertentu berada di bawah ambang batas (low stock).
 * Kuantitas <= threshold dianggap stok menipis / low stock.
 */
export function isLowStock(
  quantity: number,
  kind: LowStockItemKind,
  thresholds?: Partial<LowStockThresholdSettings>
): boolean {
  const settingKey = KIND_THRESHOLD_KEY_MAP[kind];
  const threshold = thresholds?.[settingKey] ?? KIND_DEFAULT_MAP[kind];
  return quantity <= threshold;
}

/**
 * Memeriksa apakah varian ukuran tertentu berstatus low stock dari daftar stok fisik.
 */
export function isVariantSizeLowStock(
  variantStocks: Array<{ size: string; quantity: number }> | undefined,
  targetSize: string,
  thresholds?: Partial<LowStockThresholdSettings>
): boolean {
  const found = variantStocks?.find((s) => s.size === targetSize);
  const qty = found ? found.quantity : 0;
  return isLowStock(qty, "uniform_variant", thresholds);
}
