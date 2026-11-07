import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookPackageItems, bookPackages, books } from "../db/schema";
import { cleanupOrphanDuplicateBooks } from "./cleanup-orphan-books";

describe("cleanupOrphanDuplicateBooks", () => {
  it("purges unpacketed books that have duplicate titles in packages, zero stock, and no orders", async () => {
    // 1. Buat paket dan buku master terikat paket
    const pkgId = "pkg-test-cleanup";
    await db
      .insert(bookPackages)
      .values({
        id: pkgId,
        code: "PKG-TEST-CLEANUP",
        name: "Paket Test Cleanup",
        gradeLevel: "1",
        curriculumType: "international",
        academicYear: "2026/2027",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();

    const masterBookId = "b-test-master-clean";
    await db
      .insert(books)
      .values({
        id: masterBookId,
        isbn: "BK-CLEAN-MASTER-001",
        title: "BUKU TEST BERSIH CANONICAL",
        author: "Penulis Asli",
        publisher: "Penerbit Resmi",
        price: 50000,
        sellPrice: 50000,
        buyPrice: 30000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();

    await db
      .insert(bookPackageItems)
      .values({
        id: "bpi-test-master-clean",
        packageId: pkgId,
        bookId: masterBookId,
        quantity: 1,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing();

    // 2. Buat 1 buku yatim duplikat (tidak masuk paket, stok 0, tanpa order)
    const orphanBookId = "b-test-orphan-clean";
    await db
      .insert(books)
      .values({
        id: orphanBookId,
        isbn: "BK-CLEAN-ORPHAN-001",
        title: "BUKU TEST BERSIH CANONICAL",
        author: "Penulis Duplikat",
        publisher: "Penerbit Resmi",
        price: 50000,
        sellPrice: 50000,
        buyPrice: 30000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();

    const result = await cleanupOrphanDuplicateBooks(db);
    expect(result.purgedCount).toBeGreaterThanOrEqual(1);

    // Buku yatim harus sudah terhapus
    const checkOrphan = await db.select().from(books).where(eq(books.id, orphanBookId));
    expect(checkOrphan.length).toBe(0);

    // Buku master harus tetap aman karena ada di dalam paket
    const checkMaster = await db.select().from(books).where(eq(books.id, masterBookId));
    expect(checkMaster.length).toBe(1);
  });
});
