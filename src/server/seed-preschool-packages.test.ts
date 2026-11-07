import { describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { bookPackageItems, bookPackages, books } from "../db/schema";
import { seedPreschoolPackages } from "./seed-preschool-packages";

describe("seedPreschoolPackages", () => {
  it("creates packages PKG-PG, PKG-K1, PKG-K2 and links Pelangi books with 20% discount", async () => {
    const result = await seedPreschoolPackages(db);
    expect(result.createdPackagesCount).toBe(3);
    expect(result.createdBooksCount).toBeGreaterThan(0);

    const pkgs = await db
      .select()
      .from(bookPackages)
      .where(
        inArray(bookPackages.code, [
          "PKG-PG-2026-2027",
          "PKG-K1-2026-2027",
          "PKG-K2-2026-2027",
        ])
      );
    expect(pkgs.length).toBe(3);

    // Verifikasi item di dalam paket PG
    const [pgPkg] = pkgs.filter((p) => p.code === "PKG-PG-2026-2027");
    const pgItems = await db
      .select()
      .from(bookPackageItems)
      .where(eq(bookPackageItems.packageId, pgPkg.id));
    expect(pgItems.length).toBeGreaterThanOrEqual(10);

    // Verifikasi harga buku Pelangi punya buyPrice = sellPrice * 0.8
    const [nurseryCourseA] = await db
      .select()
      .from(books)
      .where(eq(books.title, "I LEAP NURSERY ENGLISH COURSEBOOK A"));
    expect(nurseryCourseA).toBeDefined();
    expect(nurseryCourseA.sellPrice).toBe(42000);
    expect(nurseryCourseA.buyPrice).toBe(33600);
  });
});
