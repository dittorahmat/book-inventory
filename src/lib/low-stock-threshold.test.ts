import { describe, expect, it } from "bun:test";
import {
  isLowStock,
  isVariantSizeLowStock,
} from "./low-stock-threshold";

describe("low-stock-threshold (pure utilities)", () => {
  it("isLowStock mendeteksi kuantitas di bawah atau sama dengan threshold", () => {
    // Default uniform variant = 5
    expect(isLowStock(0, "uniform_variant")).toBe(true);
    expect(isLowStock(3, "uniform_variant")).toBe(true);
    expect(isLowStock(5, "uniform_variant")).toBe(true);
    expect(isLowStock(6, "uniform_variant")).toBe(false);

    // Default book = 10
    expect(isLowStock(10, "book")).toBe(true);
    expect(isLowStock(11, "book")).toBe(false);

    // Default book package = 5
    expect(isLowStock(5, "book_package")).toBe(true);
    expect(isLowStock(6, "book_package")).toBe(false);

    // Default uniform package = 5
    expect(isLowStock(5, "uniform_package")).toBe(true);
    expect(isLowStock(6, "uniform_package")).toBe(false);
  });

  it("isLowStock menghormati custom thresholds jika disediakan", () => {
    const custom = { uniformVariant: 2, book: 20 };
    expect(isLowStock(3, "uniform_variant", custom)).toBe(false);
    expect(isLowStock(2, "uniform_variant", custom)).toBe(true);
    expect(isLowStock(15, "book", custom)).toBe(true);
  });

  it("isVariantSizeLowStock membaca kuantitas size spesifik dengan benar", () => {
    const stocks = [
      { size: "M", quantity: 10 },
      { size: "L", quantity: 3 },
      { size: "XL", quantity: 0 },
    ];

    expect(isVariantSizeLowStock(stocks, "M")).toBe(false);
    expect(isVariantSizeLowStock(stocks, "L")).toBe(true);
    expect(isVariantSizeLowStock(stocks, "XL")).toBe(true);
    expect(isVariantSizeLowStock(stocks, "XXL")).toBe(true); // missing size treated as 0
    expect(isVariantSizeLowStock(undefined, "M")).toBe(true); // undefined stocks treated as 0
  });
});
