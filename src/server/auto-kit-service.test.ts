import { describe, expect, it } from "bun:test";
import { db } from "../db";
import {
  books,
  bookPackages,
  bookPackageItems,
  bookStocks,
  packageStocks,
  schools,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { autoKitMaxPackages } from "./auto-kit-service";

describe("autoKitMaxPackages runner (Ticket #355)", () => {
  it("assembles packages based on BOM and available aggregate book stocks", async () => {
    const stamp = Date.now();
    const schoolId = `sch-autokit-${stamp}`;
    const pkgId = `pkg-autokit-${stamp}`;
    const book1 = `b1-autokit-${stamp}`;
    const book2 = `b2-autokit-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: `School AutoKit ${stamp}`,
      code: `SCH-AK-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(books).values([
      { id: book1, isbn: `ISBN-AK1-${stamp}`, title: `Book 1 ${stamp}`, author: "Author", publisher: "Pub", createdAt: now, updatedAt: now },
      { id: book2, isbn: `ISBN-AK2-${stamp}`, title: `Book 2 ${stamp}`, author: "Author", publisher: "Pub", createdAt: now, updatedAt: now },
    ]);

    await db.insert(bookPackages).values({
      id: pkgId,
      code: `PKG-AK-${stamp}`,
      name: `Package AK ${stamp}`,
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(bookPackageItems).values([
      { id: `bpi1-${stamp}`, packageId: pkgId, bookId: book1, quantity: 2, createdAt: now },
      { id: `bpi2-${stamp}`, packageId: pkgId, bookId: book2, quantity: 1, createdAt: now },
    ]);

    // Book 1 has 10 units (can make 5 kits), Book 2 has 3 units (can make 3 kits) -> max kits = 3
    await db.insert(bookStocks).values([
      { id: `bs1-${stamp}`, bookId: book1, schoolId, availableQuantity: 10, reservedQuantity: 0, updatedAt: now },
      { id: `bs2-${stamp}`, bookId: book2, schoolId, availableQuantity: 3, reservedQuantity: 0, updatedAt: now },
    ]);

    try {
      const summary = await autoKitMaxPackages(db, [schoolId]);
      expect(summary.totalPackagesAssembled).toBe(3);
      expect(summary.totalBooksConsumed).toBe(3 * 2 + 3 * 1); // 9 books

      // Verify book_stocks reduced
      const [bs1] = await db.select().from(bookStocks).where(eq(bookStocks.id, `bs1-${stamp}`));
      const [bs2] = await db.select().from(bookStocks).where(eq(bookStocks.id, `bs2-${stamp}`));
      expect(bs1.availableQuantity).toBe(4); // 10 - 6
      expect(bs2.availableQuantity).toBe(0); // 3 - 3

      // Verify package_stocks credited
      const [ps] = await db.select().from(packageStocks).where(eq(packageStocks.packageId, pkgId));
      expect(ps.availableQuantity).toBe(3);
    } finally {
      await db.delete(packageStocks).where(eq(packageStocks.schoolId, schoolId));
      await db.delete(bookStocks).where(eq(bookStocks.schoolId, schoolId));
      await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, pkgId));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
      await db.delete(books).where(eq(books.id, book1));
      await db.delete(books).where(eq(books.id, book2));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});
