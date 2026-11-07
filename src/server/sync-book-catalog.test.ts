import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { books } from "../db/schema";
import { syncBookCatalogPricingAndIsbn } from "./sync-book-catalog";

describe("syncBookCatalogPricingAndIsbn", () => {
  it("aligns books buy_price with net supplier discount price and standard 13-digit ISBNs", async () => {
    // Seed sample book di test DB
    const sampleId = "test-prime-math-1a";
    await db
      .insert(books)
      .values({
        id: sampleId,
        isbn: "BK-SD1-PRIME-MATH-1A-TEST",
        title: "PRIME MATH 1A COURSEBOOK",
        author: "Scholastic Team",
        publisher: "Cambridge",
        price: 198600,
        sellPrice: 198600,
        buyPrice: 198600, // Harga kotor awal
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();

    const result = await syncBookCatalogPricingAndIsbn(db);
    expect(result.updatedCount).toBeGreaterThan(0);

    const [updated] = await db.select().from(books).where(eq(books.id, sampleId));
    expect(updated).toBeDefined();
    expect(updated.isbn).toBe("9789814969529");
    expect(updated.buyPrice).toBe(119160); // 198.600 - 40%
    expect(updated.sellPrice).toBe(198600);
  });
});
