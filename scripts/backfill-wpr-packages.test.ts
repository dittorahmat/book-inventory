import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { bookPackageItems, bookPackages, books } from "../src/db/schema";
import { WPR_BOOK_ID } from "../src/lib/wpr";
import { backfillWprPackages } from "./backfill-wpr-packages";

describe("backfillWprPackages", () => {
  it("secara idempoten menyuntikkan WPR dan menghitung ulang harga seluruh paket yang ada", async () => {
    const stamp = Date.now().toString(36);
    const now = new Date().toISOString();
    const bookId = `b-bf-${stamp}`;
    const pkgId = `pkg-bf-${stamp}`;

    // 1. Buat buku dan paket tanpa WPR
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-BF-${stamp}`,
      title: "Buku Uji Backfill",
      author: "Penulis",
      publisher: "Al-Wildan Press",
      price: 150000,
      sellPrice: 150000,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(bookPackages).values({
      id: pkgId,
      code: `PKG-BF-${stamp}`,
      name: "Paket Uji Backfill",
      gradeLevel: "1",
      academicYear: "2026/2027",
      price: 150000, // Harga awal tanpa WPR
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(bookPackageItems).values({
      id: `bpi-bf-${stamp}`,
      packageId: pkgId,
      bookId,
      quantity: 1,
      createdAt: now,
    });

    // 2. Jalankan backfill
    const result = await backfillWprPackages(db);
    expect(result.updatedPackages).toBeGreaterThanOrEqual(1);

    // 3. Verifikasi paket sekarang memiliki WPR dan harga 150.000 + 750.000 = 900.000
    const [updatedPkg] = await db.select().from(bookPackages).where(eq(bookPackages.id, pkgId));
    expect(updatedPkg.price).toBe(900000);

    const boms = await db.select().from(bookPackageItems).where(eq(bookPackageItems.packageId, pkgId));
    expect(boms.some((b) => b.bookId === WPR_BOOK_ID)).toBe(true);

    // 4. Eksekusi ulang (idempoten): tidak boleh error dan tidak boleh membuat duplikat BOM
    await backfillWprPackages(db);
    const bomsAfter = await db.select().from(bookPackageItems).where(eq(bookPackageItems.packageId, pkgId));
    const wprItems = bomsAfter.filter((b) => b.bookId === WPR_BOOK_ID);
    expect(wprItems.length).toBe(1);

    // Clean up
    await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, pkgId));
    await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
    await db.delete(books).where(eq(books.id, bookId));
  });
});
