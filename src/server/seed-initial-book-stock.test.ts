import { describe, it, expect } from "bun:test";
import { parseRekapAw1Stock, matchBookToStock } from "./seed-initial-book-stock";

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
