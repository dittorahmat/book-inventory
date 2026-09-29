import { describe, expect, it } from "bun:test";
import { getPendingNoResultQuery } from "./usePublicOrder";

describe("getPendingNoResultQuery (portal dialog hasil-kosong)", () => {
  it("opens the dialog with the trimmed query when search returns zero results", () => {
    expect(getPendingNoResultQuery("Hendra", 0)).toBe("Hendra");
  });

  it("trims surrounding whitespace before echoing the query", () => {
    expect(getPendingNoResultQuery("  Wahyudi  ", 0)).toBe("Wahyudi");
  });

  it("never opens the dialog when students are found", () => {
    expect(getPendingNoResultQuery("Hendra", 1)).toBeNull();
    expect(getPendingNoResultQuery("Hendra", 3)).toBeNull();
  });

  it("ignores queries shorter than 2 characters (no dialog, no silent prefill)", () => {
    expect(getPendingNoResultQuery("A", 0)).toBeNull();
    expect(getPendingNoResultQuery("  ", 0)).toBeNull();
    expect(getPendingNoResultQuery("", 0)).toBeNull();
  });
});
