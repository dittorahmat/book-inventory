import { describe, it, expect } from "bun:test";
import * as XLSX from "xlsx";
import {
  parseRecipientFromAddress,
  buildEkspedisiExcelBuffer,
  buildInternalLogistikExcelBuffer,
  type UniformEkspedisiRow,
  type UniformInternalLogistikRow,
} from "./shipment-excel";

describe("Uniform Shipment Excel helpers", () => {
  it("parses structured recipient address correctly and falls back cleanly", () => {
    const formatted = "Budi Santoso (08123456789) - Jl. Melati No. 10, RT 01/RW 02, Kel. Sukamaju, Kec. Cilodong, Depok 16411";
    const res = parseRecipientFromAddress(formatted, "Fallback Nama", "080000");
    expect(res.recipientName).toBe("Budi Santoso");
    expect(res.recipientPhone).toBe("08123456789");
    expect(res.cleanAddress).toBe("Jl. Melati No. 10, RT 01/RW 02, Kel. Sukamaju, Kec. Cilodong, Depok 16411");

    const unstructured = "Jl. Raya Anyar No 123";
    const resFallback = parseRecipientFromAddress(unstructured, "Ayah Siswa", "081111");
    expect(resFallback.recipientName).toBe("Ayah Siswa");
    expect(resFallback.recipientPhone).toBe("081111");
    expect(resFallback.cleanAddress).toBe("Jl. Raya Anyar No 123");
  });

  it("builds valid Excel workbook buffer for Ekspedisi format", () => {
    const data: UniformEkspedisiRow[] = [
      {
        nis: "NIS-001",
        namaSiswa: "Ahmad",
        jenjang: "SD",
        jenisKelamin: "Laki-laki",
        namaPenerima: "Bapak Ahmad",
        noKontak: "08129999",
        alamat: "Jl. Mawar No 1",
      },
    ];
    const buf = buildEkspedisiExcelBuffer(data);
    expect(buf.byteLength).toBeGreaterThan(0);

    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toContain("Ekspedisi");
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Ekspedisi"], { header: 1 });
    expect(rows[0]).toEqual([
      "NIS",
      "Nama Siswa",
      "Jenjang",
      "Jenis Kelamin",
      "Nama Penerima",
      "No Kontak",
      "Alamat",
    ]);
    expect(rows[1]).toEqual([
      "NIS-001",
      "Ahmad",
      "SD",
      "Laki-laki",
      "Bapak Ahmad",
      "08129999",
      "Jl. Mawar No 1",
    ]);
  });

  it("builds valid Excel workbook buffer for Internal Logistik format", () => {
    const data: UniformInternalLogistikRow[] = [
      {
        nis: "NIS-002",
        namaSiswa: "Fatimah",
        kelas: "SD 1A",
        jenjang: "SD",
        jenisKelamin: "Perempuan",
        sizeSeragamOlahraga: "M",
      },
    ];
    const buf = buildInternalLogistikExcelBuffer(data);
    expect(buf.byteLength).toBeGreaterThan(0);

    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toContain("Internal Logistik");
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Internal Logistik"], { header: 1 });
    expect(rows[0]).toEqual([
      "NIS",
      "Nama Siswa",
      "Kelas",
      "Jenjang",
      "Jenis Kelamin",
      "Size Seragam Olahraga",
    ]);
    expect(rows[1]).toEqual([
      "NIS-002",
      "Fatimah",
      "SD 1A",
      "SD",
      "Perempuan",
      "M",
    ]);
  });
});
