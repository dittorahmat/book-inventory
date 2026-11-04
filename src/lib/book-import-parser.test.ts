import { describe, expect, it } from "bun:test";
import * as XLSX from "xlsx";
import { inferBookPublisher, parseBookCatalogData } from "./book-import-parser";

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

  it("infers smart publishers correctly based on title keywords", () => {
    expect(inferBookPublisher("Prime Math 1A Coursebook")).toBe("Cambridge");
    expect(inferBookPublisher("English Student Book+Workbook 1")).toBe("Cambridge");
    expect(inferBookPublisher("Akidah Akhlak 1")).toBe("Al-Wildan Press");
    expect(inferBookPublisher("Weekly Progress Report 1 Tahun")).toBe("Al-Wildan Press");
    expect(inferBookPublisher("Buku Cerita Bergambar")).toBe("Al-Wildan Press");
  });


  it("parses multi-sheet Al-Wildan workbook layout with newline headers and summary sheet correctly", () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Rincian Kelas 1 INTER
    const ws1Data = [
      [null, "LOGISTICS AL-WILDAN"],
      ["DAFTAR DAN HARGA BUKU"],
      ["KELAS : 1 INTER"],
      ["No.", "NAMA BUKU", "Harga/Unit\n(Rp)", "KETERANGAN"],
      [1, "Akidah Akhlak 1", 50000, "SEMESTER GANJIL/GENAP"],
      [2, "Prime Math 1A Coursebook", 198600, "SEMESTER GANJIL"],
      [3, "Weekly Progress Report 1 Tahun", 750000, "SEMESTER GANJIL/GENAP"],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    XLSX.utils.book_append_sheet(wb, ws1, "1");

    // Sheet 2: Rincian Kelas 2 INTER
    const ws2Data = [
      [null, "LOGISTICS AL-WILDAN"],
      ["KELAS : 2 INTER (PINDAHAN)"],
      ["No.", "NAMA BUKU", "Harga/Unit (Rp)", "KETERANGAN"],
      [1, "Akidah Akhlak 2", 50000, "SEMESTER GANJIL/GENAP"],
      [2, "Prime Math 2A Coursebook", 197600, "SEMESTER GANJIL"],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    XLSX.utils.book_append_sheet(wb, ws2, "2");

    // Sheet1: Rekap formula #REF! yang harus diabaikan
    const wsSummaryData = [
      ["DAFTAR DAN HARGA PAKET BUKU"],
      ["SD"],
      ["KELAS", "BIAYA BUKU"],
      [1, 2726200, "#REF!"],
      [2, 2742200, "#REF!"],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(wsSummaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Sheet1");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const result = parseBookCatalogData(buf);

    expect(result.validBooks.length).toBe(5);
    // Spot check sheet 1
    const book1 = result.validBooks.find((b) => b.title === "Akidah Akhlak 1");
    expect(book1).toBeDefined();
    expect(book1?.gradeLevel).toBe("1");
    expect(book1?.price).toBe(50000);
    expect(book1?.publisher).toContain("Al-Wildan Press");
    expect(book1?.semester).toBe("all");

    // Spot check math book
    const mathBook = result.validBooks.find((b) => b.title === "Prime Math 1A Coursebook");
    expect(mathBook?.price).toBe(198600);
    expect(mathBook?.publisher).toContain("Cambridge");
    expect(mathBook?.semester).toBe("1");

    // Spot check sheet 2
    const book2 = result.validBooks.find((b) => b.title === "Prime Math 2A Coursebook");
    expect(book2).toBeDefined();
    expect(book2?.gradeLevel).toBe("2");
    expect(book2?.price).toBe(197600);
  });
});

