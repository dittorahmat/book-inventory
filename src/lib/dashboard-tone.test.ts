import { describe, expect, it } from "bun:test";
import { coverageTone } from "./dashboard-tone";

describe("coverageTone thresholds (T5)", () => {
  it("maps null and full coverage to emerald", () => {
    expect(coverageTone(null).bar).toBe("#10B981");
    expect(coverageTone(1.5).text).toContain("emerald");
  });
  it("maps 0.8 to blue, 0.5 to amber, below to red", () => {
    expect(coverageTone(0.9).bar).toBe("#1877F2");
    expect(coverageTone(0.5).bar).toBe("#F59E0B");
    expect(coverageTone(0.2).bar).toBe("#EF4444");
  });
});
