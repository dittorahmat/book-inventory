import { describe, expect, test } from "bun:test";
import { resolvePublicEntryTab } from "./public-portal-url";

describe("resolvePublicEntryTab", () => {
  test("deep-link refund membuka tab Refund Buku", () => {
    expect(resolvePublicEntryTab("/refund", "")).toBe("book_return");
    expect(resolvePublicEntryTab("/order", "?mode=refund")).toBe("book_return");
  });

  test("deep-link seragam membuka tab Pesan Seragam", () => {
    expect(resolvePublicEntryTab("/seragam", "")).toBe("uniform");
    expect(resolvePublicEntryTab("/", "?mode=seragam")).toBe("uniform");
  });

  test("tanpa penanda tetap di tab default (buku)", () => {
    expect(resolvePublicEntryTab("/order", "")).toBeUndefined();
    expect(resolvePublicEntryTab("/", "?mode=public")).toBeUndefined();
  });
});
