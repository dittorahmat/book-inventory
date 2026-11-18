import { describe, it, expect, afterEach } from "bun:test";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { books, bookSuppliers, suppliers } from "../../db/schema";
import { createTestBook } from "../lib/test-fixtures";
import { importSupplierMappingFromWorkbook } from "./supplier-mapping-import";

describe("supplier-mapping-import service (#499)", () => {
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
    // Siapkan mock buku via factory kanonik
    const testIsbn = "9789814969529";
    const testBook = await createTestBook(db, {
      isbn: testIsbn,
      title: "PRIME MATHS 1A",
      author: "Scholastic",
      publisher: "Scholastic",
      price: 100000,
    });
    testBookIds.push(testBook.id);

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
    expect(result.suppliersUpserted).toBeGreaterThanOrEqual(0);
    expect(result.processedSuppliers.length).toBe(1);
    expect(result.processedSuppliers[0].code).toBe("SUP-CNL");
    expect(result.processedSuppliers[0].contactPerson).toBe("Fil Rahman");
    expect(result.processedSuppliers[0].phone).toBe("0896 0274 4493");

    const [supInDb] = await db.select().from(suppliers).where(eq(suppliers.code, "SUP-CNL"));
    expect(supInDb.contactPerson).toBe("Fil Rahman");
    expect(supInDb.phone).toBe("0896 0274 4493");

    const links = await db
      .select()
      .from(bookSuppliers)
      .where(eq(bookSuppliers.bookId, testBook.id));
    expect(links.length).toBe(1);
  });

  it("mencegah bentrok judul antar jenjang saat kolom jenjang tersedia di sheet vendor", async () => {
    const sdBook = await createTestBook(db, {
      isbn: "BK-SD-MAT-1",
      title: "Matematika 1",
      category: "SD",
      author: "Tim",
      publisher: "Erlangga",
      price: 50000,
    });
    const smpBook = await createTestBook(db, {
      isbn: "BK-SMP-MAT-1",
      title: "Matematika 1",
      category: "SMP",
      author: "Tim",
      publisher: "Erlangga",
      price: 60000,
    });
    testBookIds.push(sdBook.id, smpBook.id);

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
      .where(eq(bookSuppliers.bookId, sdBook.id));
    const smpLinks = await db
      .select()
      .from(bookSuppliers)
      .where(eq(bookSuppliers.bookId, smpBook.id));

    // Buku SD yang harus terpetakan, bukan SMP
    expect(sdLinks.length).toBe(1);
    expect(smpLinks.length).toBe(0);
  });

  it("memproses multi-sheet vendor dalam satu berkas spreadsheet secara utuh", async () => {
    const cnlBook = await createTestBook(db, {
      isbn: "9789814999999",
      title: "Science Coursebook 1",
      author: "Scholastic",
      publisher: "Scholastic",
      price: 90000,
    });
    const erlanggaBook = await createTestBook(db, {
      isbn: "BK-ERL-IND-1",
      title: "Bahasa Indonesia 1",
      category: "SD",
      author: "Erlangga",
      publisher: "Erlangga",
      price: 45000,
    });
    testBookIds.push(cnlBook.id, erlanggaBook.id);

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
