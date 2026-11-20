import { describe, it, expect } from "bun:test";
import * as XLSX from "xlsx";
import {
  buildReconciliationExcelBuffer,
  type BankTransferReconciliationRow,
} from "./reconciliation-excel";

describe("Reconciliation Excel Generator", () => {
  it("builds valid Excel workbook buffer for Finance bank transfers", () => {
    const rows: BankTransferReconciliationRow[] = [
      {
        receiptId: "rcp-1",
        allocationId: "alc-1",
        studentName: "Ahmad Dahlan",
        nis: "12345",
        schoolName: "Al-Wildan 1",
        transferDate: "2026-10-20",
        totalTransfer: 1500000,
        allocationAmount: 1000000,
        transferTarget: "Buku",
        bankName: "BCA",
        referenceNumber: "REF123",
      },
      {
        receiptId: "rcp-1",
        allocationId: "alc-2",
        studentName: "Ahmad Dahlan",
        nis: "12345",
        schoolName: "Al-Wildan 1",
        transferDate: "2026-10-20",
        totalTransfer: 1500000,
        allocationAmount: 500000,
        transferTarget: "Seragam",
        bankName: "BCA",
        referenceNumber: "REF123",
      },
    ];

    const buf = buildReconciliationExcelBuffer(rows, "2026-10");
    expect(buf.byteLength).toBeGreaterThan(0);

    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toContain("Rekon-2026-10");
    const sheetData = XLSX.utils.sheet_to_json<Array<string | number>>(wb.Sheets["Rekon-2026-10"], { header: 1 });
    expect(sheetData[0]).toEqual([
      "Nama Siswa",
      "NIS",
      "Sekolah",
      "Tanggal Transfer",
      "Total Transfer (Rp)",
      "Alokasi Transfer (Rp)",
      "Tujuan Transfer",
      "Bank",
      "No Referensi",
    ]);
    expect(sheetData[1]).toEqual([
      "Ahmad Dahlan",
      "12345",
      "Al-Wildan 1",
      "2026-10-20",
      1500000,
      1000000,
      "Buku",
      "BCA",
      "REF123",
    ]);
    expect(sheetData[2]).toEqual([
      "Ahmad Dahlan",
      "12345",
      "Al-Wildan 1",
      "2026-10-20",
      1500000,
      500000,
      "Seragam",
      "BCA",
      "REF123",
    ]);
  });
});
