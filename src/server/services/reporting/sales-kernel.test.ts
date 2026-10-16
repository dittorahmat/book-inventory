import { describe, expect, it } from "bun:test";
import { escapeCsvCell, periodEndIso, quoteCsvCell, selectInChunks, toCsvInt } from "./sales-kernel";

describe("sales-kernel (shared Book + Seragam)", () => {
  it("rounds, escapes, and bounds periods identically for both reports", () => {
    expect(toCsvInt(10.4)).toBe("10");
    expect(toCsvInt(10.5)).toBe("11");
    expect(escapeCsvCell('SMAN 1, "Unggulan"')).toBe('"SMAN 1, ""Unggulan"""');
    expect(escapeCsvCell("Polos")).toBe("Polos");
    expect(quoteCsvCell("a;b")).toBe('"a;b"');
    expect(periodEndIso("2026-10-01")).toBe("2026-10-01T23:59:59.999Z");
  });

  it("chunks reads and returns empty for empty input", async () => {
    const seen: string[][] = [];
    const out = await selectInChunks([`a`, `b`, `c`], async (chunk) => {
      seen.push(chunk);
      return chunk.map((id) => ({ id }));
    });
    expect(out).toHaveLength(3);
    expect(seen.flat()).toEqual([`a`, `b`, `c`]);
    expect(await selectInChunks([], async () => [{ id: `x` }])).toEqual([]);
  });
});
