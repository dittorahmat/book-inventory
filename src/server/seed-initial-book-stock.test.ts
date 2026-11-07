import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { parseRekapAw1Stock, matchBookToStock } from "./seed-initial-book-stock";
import { seedInitialBookStock } from "./seed-initial-book-stock-service";
import { db } from "../db";
import { books, schools, bookStocks, stockAdjustments } from "../db/schema";
import { eq } from "drizzle-orm";

describe("seed-initial-book-stock parser and matching", () => {
  it("should parse stock rows correctly from CSV snippet", () => {
    const sampleCsv = `
REKAPITULASI BUKU KELUAR DAN TERBAGI ALWILDAN- 1 GADING SERPONG,,,,,,,,,,,,,,,,,,,,,,,,,,
I,No.,List Buku Umum, JUMLAH BUKU KEBUTUHAN BUKU,,,,,,,,,,,,, TOTAL, HARGA, TOTAL HARGA,KETERANGAN, UP 10%, JUMLAH, TOTAL, STOK, KB PO, PO,
,,, PG-KI-K-2, KLS 1, KLS 2, KLS 3, KLS 4, KLS 5, KLS 6, KLS 7, KLS 8, KLS 9, KLS 10, KLS 11, KLS 12,, BUKU, BUKU TERBAGI,,,,,,,,
UMUM,1,BAHASA ARAB,  125 ,,,,,,,,,,,,,  125 ,,,,10%,  13 ,  138 ,60,  78 ,  100 ,  23 
,2,Hafalan Hadist Pendek,  125 ,,,,,,,,,,,,,  125 , Rp 30.000 , Rp 3.750.000 ,,10%,  13 ,  138 ,4,  134 ,  200 ,  67 
,GRAND TOTAL,,,,,,,,,,,,,,,,, Rp 1.735.390.000 ,,,,,,,,
V,No.,Buku KLS 1 , JUMLAH BUKU, HARGA, TOTAL, KETERANGAN, UP 10%, JUMLAH, TOTAL, STOK, KB PO, PO,,,,,,,,,,,,,,
,,, KEBUTUHAN BUKU, BUKU, HARGA,,,,,,,,,,,,,,,,,,,,,
KLS 1,1,Prime Math 1A Student Book,  1.110 ,  198.600 ,  220.446.000 ,  242.490.600 ,  0 ,  111 ,  1.221 ,81,  1.140 ,  1.150 ,  10 
`.trim();

    const items = parseRekapAw1Stock(sampleCsv);
    expect(items.length).toBe(3);
    expect(items[0].sheetTitle).toBe("BAHASA ARAB");
    expect(items[0].stockQuantity).toBe(60);
    expect(items[1].sheetTitle).toBe("Hafalan Hadist Pendek");
    expect(items[1].stockQuantity).toBe(4);
    expect(items[2].sheetTitle).toBe("Prime Math 1A Student Book");
    expect(items[2].stockQuantity).toBe(81);
  });

  it("should match books with fuzzy grade-awareness", () => {
    const mockBooks = [
      { id: "b-pm-1a", title: "PRIME MATH 1A COURSEBOOK" },
      { id: "b-ha-1", title: "Hafalan Hadist Pendek" },
      { id: "b-ak-1", title: "AKIDAH AKHLAK 1" },
    ];

    const match1 = matchBookToStock("Prime Math 1A Student Book", "Buku KLS 1", mockBooks);
    expect(match1).not.toBeNull();
    expect(match1?.id).toBe("b-pm-1a");

    const match2 = matchBookToStock("Akidah Akhlak", "Buku KLS 1", mockBooks);
    expect(match2).not.toBeNull();
    expect(match2?.id).toBe("b-ak-1");
  });
});

describe("seedInitialBookStock DB execution & parity (§0.58.2, §0.62.1)", () => {
  const schoolWarehouseId = "school-warehouse";
  const now = new Date().toISOString();

  beforeEach(async () => {
    // Bersihkan data uji terkait
    await db.delete(stockAdjustments).where(eq(stockAdjustments.schoolId, schoolWarehouseId));
    await db.delete(bookStocks).where(eq(bookStocks.schoolId, schoolWarehouseId));
    await db.delete(books).where(eq(books.id, "b-test-arab"));
    await db.delete(books).where(eq(books.id, "b-test-pm1a"));
    await db.delete(schools).where(eq(schools.id, schoolWarehouseId));

    await db.insert(schools).values({
      id: schoolWarehouseId,
      name: "Gudang Logistik Pusat",
      code: "GUDANG-LOG",
      type: "warehouse",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(books).values([
      {
        id: "b-test-arab",
        isbn: "978-0000000001",
        title: "BAHASA ARAB",
        author: "Al-Wildan",
        publisher: "Segara",
        price: 125000,
        buyPrice: 90000,
        sellPrice: 125000,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "b-test-pm1a",
        isbn: "978-0000000002",
        title: "PRIME MATH 1A COURSEBOOK",
        author: "Scholastic",
        publisher: "Scholastic",
        price: 198600,
        buyPrice: 119160,
        sellPrice: 198600,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it("should mutate book_stocks via moveInventoryStock and record stock_adjustments audit log", async () => {
    const testCsv = `
REKAPITULASI BUKU KELUAR DAN TERBAGI ALWILDAN- 1 GADING SERPONG,,,,,,,,,,,,,,,,,,,,,,,,,,
I,No.,List Buku Umum, JUMLAH BUKU KEBUTUHAN BUKU,,,,,,,,,,,,, TOTAL, HARGA, TOTAL HARGA,KETERANGAN, UP 10%, JUMLAH, TOTAL, STOK, KB PO, PO,
,,, PG-KI-K-2, KLS 1, KLS 2, KLS 3, KLS 4, KLS 5, KLS 6, KLS 7, KLS 8, KLS 9, KLS 10, KLS 11, KLS 12,, BUKU, BUKU TERBAGI,,,,,,,,
UMUM,1,BAHASA ARAB,  125 ,,,,,,,,,,,,,  125 ,,,,10%,  13 ,  138 ,60,  78 ,  100 ,  23 
V,No.,Buku KLS 1 , JUMLAH BUKU, HARGA, TOTAL, KETERANGAN, UP 10%, JUMLAH, TOTAL, STOK, KB PO, PO,,,,,,,,,,,,,,
,,, KEBUTUHAN BUKU, BUKU, HARGA,,,,,,,,,,,,,,,,,,,,,
KLS 1,1,Prime Math 1A Student Book,  1.110 ,  198.600 ,  220.446.000 ,  242.490.600 ,  0 ,  111 ,  1.221 ,81,  1.140 ,  1.150 ,  10 
`.trim();

    const result = await seedInitialBookStock(db, testCsv, { schoolId: schoolWarehouseId });
    expect(result.totalRowsParsed).toBe(2);
    expect(result.matchedCount).toBe(2);
    expect(result.uniqueBooksCount).toBe(2);
    expect(result.totalQuantity).toBe(141); // 60 + 81

    // Verifikasi saldo book_stocks
    const arabStock = await db
      .select()
      .from(bookStocks)
      .where(eq(bookStocks.bookId, "b-test-arab"));
    expect(arabStock.length).toBe(1);
    expect(arabStock[0].availableQuantity).toBe(60);

    const pmStock = await db
      .select()
      .from(bookStocks)
      .where(eq(bookStocks.bookId, "b-test-pm1a"));
    expect(pmStock.length).toBe(1);
    expect(pmStock[0].availableQuantity).toBe(81);

    // Verifikasi audit log stock_adjustments
    const adjs = await db.select().from(stockAdjustments);
    expect(adjs.length).toBe(2);
    expect(adjs[0].reason).toBe("audit_reconciliation");
    expect(adjs[0].referenceDocumentNumber).toBe("REKAP-AW1-2026-2027");
  });

  afterEach(async () => {
    // Bersihkan fixture agar tidak mencemari test lain di run bersamaan
    await db.delete(stockAdjustments).where(eq(stockAdjustments.schoolId, schoolWarehouseId));
    await db.delete(bookStocks).where(eq(bookStocks.schoolId, schoolWarehouseId));
    await db.delete(books).where(eq(books.id, "b-test-arab"));
    await db.delete(books).where(eq(books.id, "b-test-pm1a"));
    await db.delete(schools).where(eq(schools.id, schoolWarehouseId));
  });
});
