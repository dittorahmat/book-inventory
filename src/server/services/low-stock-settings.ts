import type { AppDatabase } from "../../db";
import { readSettingsMap } from "./settings-map";
import {
  LOW_STOCK_THRESHOLD_KEYS,
  DEFAULT_LOW_STOCK_THRESHOLDS,
  type LowStockThresholdSettings,
} from "../../lib/low-stock-threshold";

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
