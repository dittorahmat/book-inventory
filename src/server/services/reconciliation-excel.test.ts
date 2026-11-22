import { describe, it, expect } from "bun:test";
import * as XLSX from "xlsx";
import {
  buildReconciliationExcelBuffer,
  type BankTransferReconciliationRow,
} from "./reconciliation-excel";

describe("Reconciliation Excel Generator", () => {
  it("builds valid Excel workbook buffer for Finance bank transfers with pivot structure", () => {
    const rows: BankTransferReconciliationRow[] = [
      {
        receiptId: "rcp-1",
        studentName: "Ahmad Dahlan",
        nis: "12345",
        schoolName: "Al-Wildan 1",
        transferDate: "2026-10-20",
        totalTransfer: 1500000,
        bookAllocation: 1000000,
        uniformAllocation: 500000,
        unallocatedAmount: 0,
        bankName: "BCA",
        referenceNumber: "REF123",
        verificationStatus: "verified",
      },
      {
        receiptId: "rcp-2",
        studentName: "Siti Fatimah",
        nis: "67890",
        schoolName: "Al-Wildan 2",
        transferDate: "2026-10-21",
        totalTransfer: 2000000,
        bookAllocation: 1200000,
        uniformAllocation: 0,
        unallocatedAmount: 800000,
        bankName: "Mandiri",
        referenceNumber: null,
        verificationStatus: "verified",
      },
    ];

    const buf = buildReconciliationExcelBuffer(rows, "2026-10");
    expect(buf.byteLength).toBeGreaterThan(0);

    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toContain("Rekon-2026-10");
    const sheetData = XLSX.utils.sheet_to_json<Array<string | number>>(wb.Sheets["Rekon-2026-10"], { header: 1 });
    expect(sheetData[0]).toEqual([
      "Tanggal Transfer",
      "Nama Siswa",
      "NIS",
      "Sekolah",
      "Bank",
      "No Referensi",
      "Total Transfer (Rp)",
      "Alokasi Buku (Rp)",
      "Alokasi Seragam (Rp)",
      "Sisa / Unallocated (Rp)",
      "Status Verifikasi",
    ]);
    expect(sheetData[1]).toEqual([
      "2026-10-20",
      "Ahmad Dahlan",
      "12345",
      "Al-Wildan 1",
      "BCA",
      "REF123",
      1500000,
      1000000,
      500000,
      0,
      "verified",
    ]);
    expect(sheetData[2]).toEqual([
      "2026-10-21",
      "Siti Fatimah",
      "67890",
      "Al-Wildan 2",
      "Mandiri",
      "—",
      2000000,
      1200000,
      0,
      800000,
      "verified",
    ]);
  });
});
