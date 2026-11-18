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

/**
 * Menentukan apakah kuantitas stok tertentu berada di bawah ambang batas (low stock).
 * Kuantitas <= threshold dianggap stok menipis / low stock.
 */
export function isLowStock(
  quantity: number,
  kind: LowStockItemKind,
  thresholds?: Partial<LowStockThresholdSettings>
): boolean {
  let threshold: number;
  switch (kind) {
    case "book":
      threshold = thresholds?.book ?? DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.BOOK];
      break;
    case "book_package":
      threshold = thresholds?.bookPackage ?? DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.BOOK_PACKAGE];
      break;
    case "uniform_variant":
      threshold = thresholds?.uniformVariant ?? DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.UNIFORM_VARIANT];
      break;
    case "uniform_package":
      threshold = thresholds?.uniformPackage ?? DEFAULT_LOW_STOCK_THRESHOLDS[LOW_STOCK_THRESHOLD_KEYS.UNIFORM_PACKAGE];
      break;
  }
  return quantity <= threshold;
}
