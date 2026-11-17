import { describe, it, expect, afterEach } from "bun:test";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { books, bookSuppliers, suppliers } from "../../db/schema";
import { importSupplierMappingFromWorkbook } from "./supplier-mapping-import";

describe("supplier-mapping-import service (#499)", () => {
  const now = new Date().toISOString();
  const testBookIds: string[] = [];
  const testSupplierCodes = ["SUP-CNL", "SUP-ERLANGGA"];

  afterEach(async () => {
    for (const bId of testBookIds) {
      await db.delete(bookSuppliers).where(eq(bookSuppliers.bookId, bId));
      await db.delete(books).where(eq(books.id, bId));
    }
    for (const code of testSupplierCodes) {
      await db.delete(suppliers).where(eq(suppliers.code, code));
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
    expect(result.suppliersUpserted).toBe(1);

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

  it("memproses multi-sheet vendor dalam satu berkas spreadsheet secara utuh", async () => {
    const cnlBookId = `book-cnl-${Date.now()}`;
    const erlanggaBookId = `book-erl-${Date.now()}`;
    testBookIds.push(cnlBookId, erlanggaBookId);

    await db.insert(books).values([
      {
        id: cnlBookId,
        isbn: "9789814999999",
        title: "Science Coursebook 1",
        author: "Scholastic",
        publisher: "Scholastic",
        price: 90000,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: erlanggaBookId,
        isbn: "BK-ERL-IND-1",
        title: "Bahasa Indonesia 1",
        category: "SD",
        author: "Erlangga",
        publisher: "Erlangga",
        price: 45000,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const wb = XLSX.utils.book_new();

    // Sheet 1: CNL
    const cnlRows: unknown[][] = [];
    for (let i = 0; i < 10; i++) cnlRows.push([`header-${i}`]);
    cnlRows.push([1, "9789814999999", "Science Coursebook 1"]);
    const wsCnl = XLSX.utils.aoa_to_sheet(cnlRows);
    XLSX.utils.book_append_sheet(wb, wsCnl, "CNL");

    // Sheet 2: ERLANGGA
    const erlanggaRows: unknown[][] = [];
    for (let i = 0; i < 8; i++) erlanggaRows.push([`header-${i}`]);
    erlanggaRows.push([1, "SD", "old title", 50, "Bahasa Indonesia 1"]);
    const wsErl = XLSX.utils.aoa_to_sheet(erlanggaRows);
    XLSX.utils.book_append_sheet(wb, wsErl, "ERLANGGA");

    const result = await importSupplierMappingFromWorkbook(db, wb);

    expect(result.totalSheetsProcessed).toBe(2);
    expect(result.booksMatched).toBe(2);
  });
});
