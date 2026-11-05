import { describe, expect, it } from "bun:test";
import { determineIntakeType, curriculumLabel, CANONICAL_CURRICULUM_OPTIONS } from "./curriculum";

describe("curriculum helpers", () => {
  it("determines intake type correctly from academic year and NIS prefix", () => {
    // 2026/2027 -> target prefix "2627"
    expect(determineIntakeType("262710001", "2026/2027")).toBe("baru");
    expect(determineIntakeType("252610002", "2026/2027")).toBe("kenaikan");
    expect(determineIntakeType("242510003", "2026/2027")).toBe("kenaikan");

    // Format 2025/2026
    expect(determineIntakeType("252610001", "2025/2026")).toBe("baru");
    expect(determineIntakeType("262710001", "2025/2026")).toBe("kenaikan");
  });

  it("labels canonical and legacy curricula consistently", () => {
    expect(curriculumLabel("INTER")).toBe("Internasional");
    expect(curriculumLabel("international")).toBe("Internasional");
    expect(curriculumLabel("MQ")).toBe("Markaz Al-Qur'an (Nasional Plus)");
    expect(curriculumLabel("national")).toBe("Nasional");
    expect(curriculumLabel("AE")).toBe("Al-Wildan English (AE)");
    expect(curriculumLabel("ME")).toBe("Middle East (ME)");
    expect(curriculumLabel("DI")).toBe("Dual International (DI)");
    expect(curriculumLabel("TK")).toBe("TK / Preschool");
  });

  it("provides canonical curriculum options", () => {
    expect(CANONICAL_CURRICULUM_OPTIONS.length).toBe(6);
    expect(CANONICAL_CURRICULUM_OPTIONS.map((o) => o.value)).toEqual([
      "TK",
      "INTER",
      "AE",
      "ME",
      "DI",
      "MQ",
    ]);
  });
});
