import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
import { BankTransferReconciliationTable } from "./BankTransferReconciliationTable";
import type { BankTransferReconciliationItem } from "./recon-transfers-types";

afterEach(() => {
  cleanup();
});

const sampleTransfers: BankTransferReconciliationItem[] = [
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
    referenceNumber: "REF-BCA-100",
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

describe("BankTransferReconciliationTable", () => {
  it("merender tabel pivot transfer bank dengan alokasi buku, seragam, dan unallocated", () => {
    let exported = false;
    render(
      <BankTransferReconciliationTable
        transfers={sampleTransfers}
        onExportExcel={() => {
          exported = true;
        }}
      />
    );

    expect(screen.getByText("Ahmad Dahlan")).toBeDefined();
    expect(screen.getByText("Siti Fatimah")).toBeDefined();
    expect(screen.getByText("Al-Wildan 1")).toBeDefined();
    expect(screen.getByText("Al-Wildan 2")).toBeDefined();
    expect(screen.getByText("REF-BCA-100")).toBeDefined();
    expect(screen.getAllByText("Terverifikasi").length).toBe(2);

    // Verifikasi tombol ekspor excel
    const exportBtn = screen.getByText("Ekspor Excel (.xlsx)");
    fireEvent.click(exportBtn);
    expect(exported).toBe(true);
  });

  it("menyaring baris berdasarkan pencarian nama siswa", () => {
    render(
      <BankTransferReconciliationTable
        transfers={sampleTransfers}
        onExportExcel={() => {}}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Cari nama siswa/i);
    fireEvent.change(searchInput, { target: { value: "Ahmad" } });

    expect(screen.getByText("Ahmad Dahlan")).toBeDefined();
    expect(screen.queryByText("Siti Fatimah")).toBeNull();
  });
});
