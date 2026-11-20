import { describe, expect, it } from "bun:test";
import { CANONICAL_D1_TARGETS, resolveD1Targets } from "./d1-targets";

describe("d1-targets canonical configuration", () => {
  it("mengembalikan seluruh target canonical secara default", () => {
    const targets = resolveD1Targets();
    expect(targets).toHaveLength(2);
    expect(targets[0].name).toBe("book-inventory-db");
    expect(targets[0].env).toBeUndefined();
    expect(targets[1].name).toBe("inv-aw-db");
    expect(targets[1].env).toBe("inv-aw");
  });

  it("secara otomatis memetakan env yang cocok saat customDb diberikan nama instance clone", () => {
    const targets = resolveD1Targets("inv-aw-db");
    expect(targets).toHaveLength(1);
    expect(targets[0].name).toBe("inv-aw-db");
    expect(targets[0].env).toBe("inv-aw");
  });

  it("mendukung penentuan env eksplisit untuk custom database baru", () => {
    const targets = resolveD1Targets("custom-db", "staging");
    expect(targets).toHaveLength(1);
    expect(targets[0].name).toBe("custom-db");
    expect(targets[0].env).toBe("staging");
  });

  it("CANONICAL_D1_TARGETS memuat konfigurasi valid", () => {
    expect(CANONICAL_D1_TARGETS.length).toBeGreaterThanOrEqual(2);
    for (const target of CANONICAL_D1_TARGETS) {
      expect(target.name).toBeTruthy();
      expect(target.description).toBeTruthy();
    }
  });
});
