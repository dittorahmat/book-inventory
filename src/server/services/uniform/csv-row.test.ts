import { describe, expect, it } from "bun:test";
import { quoteCsvCell } from "../reporting/sales-kernel";
import { buildEkspedisiCsv, buildPackingCsv, type UniformExportRow } from "./report";
import { EKSPEDISI_CSV_HEADER, PACKING_CSV_HEADER, normalizeCsvNis } from "./csv-row";

const row = (nis: string): UniformExportRow => ({
  orderId: "ord-1", orderNumber: "USO-1", studentName: "Anak", nis,
  gradeLevel: "2", jenjang: "sd", gender: "ikhwan", parentPhone: "0812",
  address: "Jl. X RT 01 RW 01, 12345", size: "M", quantity: 1,
  paymentStatus: "paid", shippingCost: 0, shippingResi: "",
});

describe("uniform csv-row seam: export ⇄ import berkunci NIS", () => {
  it("header export identik dengan seam (rename pecah di kedua sisi)", () => {
    const packingHeader = buildPackingCsv([row("1")]).split("\r\n")[0];
    expect(packingHeader).toBe([...PACKING_CSV_HEADER].map(quoteCsvCell).join(";"));
    const ekspedisiHeader = buildEkspedisiCsv([row("1")]).split("\r\n")[0];
    expect(ekspedisiHeader).toBe([...EKSPEDISI_CSV_HEADER].map(quoteCsvCell).join(";"));
    expect([...PACKING_CSV_HEADER]).toContain("nis");
    expect([...EKSPEDISI_CSV_HEADER]).toContain("nis");
  });

  it("NIS export ternormalisasi sama dengan kunci import", () => {
    const csv = buildPackingCsv([row("  NIS-1  ")]);
    expect(csv).toContain(normalizeCsvNis("  NIS-1  "));
    expect(normalizeCsvNis("  NIS-1  ")).toBe("NIS-1");
  });
});
