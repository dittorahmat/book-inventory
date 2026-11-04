import { describe, it, expect } from "bun:test";
import { calculateDedupMetrics } from "./intake-dedup";

describe("calculateDedupMetrics", () => {
  it("returns zero duplicates when raw count matches unique count", () => {
    const res = calculateDedupMetrics(10, 10, 0);
    expect(res.rawReadCount).toBe(10);
    expect(res.uniqueCount).toBe(10);
    expect(res.duplicateCount).toBe(0);
  });

  it("calculates duplicates accurately when raw count is larger than unique count", () => {
    const res = calculateDedupMetrics(15, 10, 0);
    expect(res.duplicateCount).toBe(5);
  });

  it("does not conflate skipped invalid rows with duplicate rows", () => {
    // 10 raw rows: 6 valid unique, 3 invalid/skipped rows, 1 true duplicate
    const res = calculateDedupMetrics(10, 6, 3);
    expect(res.uniqueCount).toBe(6);
    expect(res.skippedInvalidCount).toBe(3);
    expect(res.duplicateCount).toBe(1); // 10 - (6 + 3) = 1
  });

  it("handles undefined raw count gracefully", () => {
    const res = calculateDedupMetrics(undefined, 8, 2);
    expect(res.rawReadCount).toBe(8);
    expect(res.duplicateCount).toBe(0);
  });
});
