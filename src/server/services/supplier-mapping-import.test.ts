import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { books, bookSuppliers } from "../../db/schema";
import { importSupplierMappingFromWorkbook } from "./supplier-mapping-import";

describe("supplier-mapping-import service (#499)", () => {
  const now = new Date().toISOString();
  const testBookIds: string[] = [];

  beforeEach(async () => {
    await db.delete(bookSuppliers);
  });

  afterEach(async () => {
    for (const bId of testBookIds) {
      await db.delete(bookSuppliers).where(eq(bookSuppliers.bookId, bId));
      await db.delete(books).where(eq(books.id, bId));
    }
    testBookIds.length = 0;
  });

  it("memetakan buku ke supplier berdasarkan ISBN dan nama sheet vendor", async () => {
    // Siapkan mock buku
    const testBookId = `book-test-${Date.now()}`;
    testBookIds.push(testBookId);
    const testIsbn = "9789814969529";
    await db.insert(books).values({
      id: testBookId,
      isbn: testIsbn,
      title: "PRIME MATHS 1A",
      author: "Scholastic",
      publisher: "Scholastic",
      price: 100000,
      createdAt: now,
      updatedAt: now,
    });

    const wb = XLSX.utils.book_new();
    const cnlRows: unknown[][] = [];
    for (let i = 0; i < 10; i++) {
      cnlRows.push([`header-${i}`]);
    }
    // startRow = 10 -> baris index 10 adalah data pertama
    cnlRows.push([1, testIsbn, "PR1ME MATHS COURSEBOOK 1A (INDONESIA EDITION)"]);
    const ws = XLSX.utils.aoa_to_sheet(cnlRows);
    XLSX.utils.book_append_sheet(wb, ws, "CNL");

    const result = await importSupplierMappingFromWorkbook(db, wb);

    expect(result.totalSheetsProcessed).toBe(1);
    expect(result.booksMatched).toBe(1);

    const links = await db
      .select()
      .from(bookSuppliers)
      .where(eq(bookSuppliers.bookId, testBookId));
    expect(links.length).toBe(1);
  });

  it("mencegah bentrok judul antar jenjang saat kolom jenjang tersedia di sheet vendor", async () => {
    const sdBookId = `book-sd-${Date.now()}`;
    const smpBookId = `book-smp-${Date.now()}`;
    testBookIds.push(sdBookId, smpBookId);

    await db.insert(books).values([
      {
        id: sdBookId,
        isbn: "BK-SD-MAT-1",
        title: "Matematika 1",
        category: "SD",
        author: "Tim",
        publisher: "Erlangga",
        price: 50000,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: smpBookId,
        isbn: "BK-SMP-MAT-1",
        title: "Matematika 1",
        category: "SMP",
        author: "Tim",
        publisher: "Erlangga",
        price: 60000,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const wb = XLSX.utils.book_new();
    const erlanggaRows: unknown[][] = [];
    for (let i = 0; i < 8; i++) {
      erlanggaRows.push([`header-${i}`]);
    }
    // ERLANGGA: startRow: 8, titleCol: 4, isbnCol: null, gradeCol: 1
    erlanggaRows.push([1, "SD", "old title", 100, "Matematika 1"]);
    const ws = XLSX.utils.aoa_to_sheet(erlanggaRows);
    XLSX.utils.book_append_sheet(wb, ws, "ERLANGGA");

    const result = await importSupplierMappingFromWorkbook(db, wb);

    expect(result.booksMatched).toBe(1);

    const sdLinks = await db
      .select()
      .from(bookSuppliers)
      .where(eq(bookSuppliers.bookId, sdBookId));
    const smpLinks = await db
      .select()
      .from(bookSuppliers)
      .where(eq(bookSuppliers.bookId, smpBookId));

    // Buku SD yang harus terpetakan, bukan SMP
    expect(sdLinks.length).toBe(1);
    expect(smpLinks.length).toBe(0);
  });
});
