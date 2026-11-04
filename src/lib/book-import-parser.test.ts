import { describe, expect, it } from "bun:test";
import { parseBookCatalogData } from "./book-import-parser";

describe("book-import-parser", () => {
  it("parses CSV catalog string correctly", () => {
    const csv = [
      "judul,kelas,harga,penerbit,isbn",
      "Cambridge Primary English 1,1,120000,Cambridge,978-1108742719",
      "Matematika Tahfidz 2,2,75000,Al-Wildan Press,978-6020001",
    ].join("\n");

    const result = parseBookCatalogData(csv);
    expect(result.validBooks.length).toBe(2);
    expect(result.validBooks[0].title).toBe("Cambridge Primary English 1");
    expect(result.validBooks[0].gradeLevel).toBe("1");
    expect(result.validBooks[0].price).toBe(120000);
    expect(result.validBooks[0].publisher).toBe("Cambridge");
    expect(result.validBooks[0].isbn).toBe("978-1108742719");
  });

  it("handles duplicate title within same grade by skipping", () => {
    const csv = [
      "judul,kelas,harga",
      "Sains Kelas 1,1,50000",
      "Sains Kelas 1,1,50000",
      "Sains Kelas 2,2,55000",
    ].join("\n");

    const result = parseBookCatalogData(csv);
    expect(result.validBooks.length).toBe(2);
    expect(result.skippedRows.length).toBe(1);
    expect(result.skippedRows[0].reason).toContain("Duplikat");
  });
});
