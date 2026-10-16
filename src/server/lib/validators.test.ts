import { describe, expect, it } from "bun:test";
import { isTestSeedValue } from "./validators";

describe("isTestSeedValue (§6 anti-bocor sampah test)", () => {
  it("menandai pola id/nama baris uji yang terbukti bocor ke prod", () => {
    for (const v of [
      "school-empty-1790576713055",
      "school-iso-a-1790676934007",
      "school-lock-1790576713037",
      "school-nis-1790676933954",
      "school-sch-1790676795879",
      "school-t4-a-123",
      "school-vol-123",
      "school-tm-123",
      "TEST-DSH-SCH",
      "SUP-WF-001",
      "Al Wildan Empty test",
      "Sekolah school-nis-1790676933954",
      "Al Wildan Scholarship Test",
    ]) {
      expect(isTestSeedValue(v)).toBe(true);
    }
  });

  it("melewatkan id/nama production asli", () => {
    for (const v of [
      "school-alw-1",
      "school-warehouse",
      "Al Wildan 1 (Islamic School Pusat)",
      "Gudang Logistik Al Wildan",
      "pkg-sd1-int",
      "latest",
      "contest",
      null,
      undefined,
      123,
    ]) {
      expect(isTestSeedValue(v)).toBe(false);
    }
  });
});
