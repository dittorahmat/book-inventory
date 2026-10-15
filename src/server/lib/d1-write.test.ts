import { describe, expect, it } from "bun:test";
import { D1_INLIST_CHUNK_SIZE, selectInChunks } from "./d1-write";

describe("selectInChunks (D1 IN-list seam)", () => {
  it("splits ids exceeding the chunk size and concatenates results in order", async () => {
    const ids = Array.from({ length: D1_INLIST_CHUNK_SIZE + 5 }, (_, i) => `id-${i}`);
    const seen: string[][] = [];
    const out = await selectInChunks<string>(ids, (chunk) => {
      seen.push(chunk);
      return Promise.resolve(chunk.map((id) => `row-${id}`));
    });
    expect(seen.length).toBe(2);
    expect(seen[0].length).toBe(D1_INLIST_CHUNK_SIZE);
    expect(seen[1].length).toBe(5);
    expect(out.length).toBe(ids.length);
    expect(out[0]).toBe("row-id-0");
    expect(out[out.length - 1]).toBe(`row-id-${ids.length - 1}`);
  });

  it("issues a single query when ids fit in one chunk", async () => {
    let calls = 0;
    const out = await selectInChunks<number>(["a", "b"], (chunk) => {
      calls += 1;
      return Promise.resolve(chunk.map((_, i) => i));
    });
    expect(calls).toBe(1);
    expect(out).toEqual([0, 1]);
  });
});
