import { describe, expect, it } from "bun:test";
import { SCHOOL_CODES, SCHOOL_IDS } from "./school-constants";

describe("school-constants (§0.65)", () => {
  it("should define unique school identifiers and mappings", () => {
    expect(SCHOOL_IDS.ALW_1_HQ).toBe("school-alw-1");
    expect(SCHOOL_IDS.WAREHOUSE).toBe("school-warehouse");
    expect(SCHOOL_CODES[SCHOOL_IDS.ALW_1_HQ]).toBe("ALW-01-HQ");
    expect(SCHOOL_CODES[SCHOOL_IDS.WAREHOUSE]).toBe("GUDANG-LOG");
  });
});
