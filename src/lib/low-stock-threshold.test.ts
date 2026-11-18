import { describe, expect, it } from "bun:test";
import {
  LOW_STOCK_THRESHOLD_KEYS,
  getLowStockThresholdSettings,
  isLowStock,
  isVariantSizeLowStock,
} from "./low-stock-threshold";
import { db } from "../db";
import { systemSettings } from "../db/schema";
import { inArray } from "drizzle-orm";

describe("low-stock-threshold", () => {
  it("mengembalikan default threshold bila system_settings belum diset", async () => {
    const keys = Object.values(LOW_STOCK_THRESHOLD_KEYS);
    await db.delete(systemSettings).where(inArray(systemSettings.key, keys));

    const thresholds = await getLowStockThresholdSettings(db);
    expect(thresholds.book).toBe(10);
    expect(thresholds.bookPackage).toBe(5);
    expect(thresholds.uniformVariant).toBe(5);
    expect(thresholds.uniformPackage).toBe(5);
  });

  it("membaca nilai custom dari system_settings jika ada", async () => {
    const keys = Object.values(LOW_STOCK_THRESHOLD_KEYS);
    await db.delete(systemSettings).where(inArray(systemSettings.key, keys));
    const now = new Date().toISOString();

    await db.insert(systemSettings).values([
      { key: LOW_STOCK_THRESHOLD_KEYS.BOOK, value: "15", updatedAt: now },
      { key: LOW_STOCK_THRESHOLD_KEYS.BOOK_PACKAGE, value: "8", updatedAt: now },
      { key: LOW_STOCK_THRESHOLD_KEYS.UNIFORM_VARIANT, value: "7", updatedAt: now },
      { key: LOW_STOCK_THRESHOLD_KEYS.UNIFORM_PACKAGE, value: "4", updatedAt: now },
    ]);

    try {
      const thresholds = await getLowStockThresholdSettings(db);
      expect(thresholds.book).toBe(15);
      expect(thresholds.bookPackage).toBe(8);
      expect(thresholds.uniformVariant).toBe(7);
      expect(thresholds.uniformPackage).toBe(4);
    } finally {
      await db.delete(systemSettings).where(inArray(systemSettings.key, keys));
    }
  });

  it("isLowStock mendeteksi kuantitas di bawah atau sama dengan threshold", () => {
    // Default uniform variant = 5
    expect(isLowStock(0, "uniform_variant")).toBe(true);
    expect(isLowStock(3, "uniform_variant")).toBe(true);
    expect(isLowStock(5, "uniform_variant")).toBe(true);
    expect(isLowStock(6, "uniform_variant")).toBe(false);

    // Default book = 10
    expect(isLowStock(10, "book")).toBe(true);
    expect(isLowStock(11, "book")).toBe(false);

    // Custom threshold
    expect(isLowStock(8, "uniform_variant", { uniformVariant: 12 })).toBe(true);
    expect(isLowStock(15, "uniform_variant", { uniformVariant: 12 })).toBe(false);
  });

  it("isVariantSizeLowStock mengevaluasi kuantitas stok per varian ukuran spesifik (ADR-0024)", () => {
    const stocks = [
      { size: "S", quantity: 8 },
      { size: "M", quantity: 2 },
      { size: "L", quantity: 5 },
    ];

    // Default uniform variant threshold = 5
    expect(isVariantSizeLowStock(stocks, "S")).toBe(false); // 8 > 5
    expect(isVariantSizeLowStock(stocks, "M")).toBe(true);  // 2 <= 5
    expect(isVariantSizeLowStock(stocks, "L")).toBe(true);  // 5 <= 5
    expect(isVariantSizeLowStock(stocks, "XL")).toBe(true); // 0 <= 5 (tidak ditemukan dalam stok)
    expect(isVariantSizeLowStock(undefined, "S")).toBe(true); // 0 <= 5
  });
});
