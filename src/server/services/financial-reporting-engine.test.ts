import { describe, expect, it } from "bun:test";
import { buildCsvDocument, computeFinancialTotals } from "./financial-reporting-engine";

describe("FinancialReportingEngine Seam", () => {
  it("merakit dokumen CSV dengan quote escaping dan baris CRLF", () => {
    const headers = ["Nama Sekolah", "Kota", "Catatan"];
    const rows = [
      ["Al Wildan 1", "Tangerang", 'Khusus program "Cambridge"'],
      ["Al Wildan 2", "Bekasi", "Reguler"],
    ];

    const csv = buildCsvDocument(headers, rows);
    expect(csv).toContain('"Nama Sekolah","Kota","Catatan"');
    expect(csv).toContain('"Al Wildan 1","Tangerang","Khusus program ""Cambridge"""');
    expect(csv).toContain("\r\n");
  });

  it("menghitung metrik total finansial secara agregat", () => {
    const rows = [
      { orderCount: 2, quantity: 10, revenue: 1000000, collected: 800000, outstanding: 200000 },
      { orderCount: 3, quantity: 15, revenue: 1500000, collected: 1500000, outstanding: 0 },
    ];

    const totals = computeFinancialTotals(rows);
    expect(totals.orderCount).toBe(5);
    expect(totals.totalQuantity).toBe(25);
    expect(totals.totalRevenue).toBe(2500000);
    expect(totals.totalCollected).toBe(2300000);
    expect(totals.totalOutstanding).toBe(200000);
  });
});
