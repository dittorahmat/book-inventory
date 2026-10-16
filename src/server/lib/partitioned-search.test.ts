import { describe, expect, it } from "bun:test";
import { matchAnyLower, matchLower, partitionedPattern } from "./partitioned-search";
import { uniformOrderStage, uniformStageFilter } from "../services/uniform/report";
import { students } from "../../db/schema";

describe("partitioned-search adapter (§11)", () => {
  it("normalizes pattern to trimmed lowercase substring", () => {
    expect(partitionedPattern("  Salsa ")).toBe("%salsa%");
    expect(partitionedPattern("ANNISA")).toBe("%annisa%");
  });

  it("builds lower() LIKE per column and undefined for empty set", () => {
    expect(matchAnyLower([], "salsa")).toBeUndefined();
    expect(matchLower(students.name, "Salsa")).toBeDefined();
    expect(matchAnyLower([students.name, students.nis], "Salsa")).toBeDefined();
  });

  it("keeps stage filter co-located with stage definition (no drift)", () => {
    expect(uniformStageFilter("unknown")).toEqual([]);
    expect(uniformStageFilter("pemesanan")).toHaveLength(1);
    expect(uniformStageFilter("tagihan")).toHaveLength(2);
    expect(uniformStageFilter("konfirmasi")).toHaveLength(1);
    expect(uniformStageFilter("lunas")).toHaveLength(1);
    expect(uniformOrderStage({ invoiceSentAt: null, paymentStatus: "unpaid" })).toBe("pemesanan");
    expect(uniformOrderStage({ invoiceSentAt: "2026-01-01", paymentStatus: "paid" })).toBe("lunas");
  });

  it("agrees with stage derivation on every representative row (parity guard)", () => {
    const samples = [
      { invoiceSentAt: null, paymentStatus: "unpaid" },
      { invoiceSentAt: "2026-10-01", paymentStatus: "unpaid" },
      { invoiceSentAt: "2026-10-01", paymentStatus: "partial" },
      { invoiceSentAt: "2026-10-01", paymentStatus: "paid" },
    ] as const;
    for (const s of samples) {
      const stage = uniformOrderStage({ invoiceSentAt: s.invoiceSentAt, paymentStatus: s.paymentStatus });
      expect(uniformStageFilter(stage).length).toBeGreaterThan(0);
      expect(uniformStageFilter("unknown")).toEqual([]);
    }
    expect(new Set(samples.map((s) => uniformOrderStage({ invoiceSentAt: s.invoiceSentAt, paymentStatus: s.paymentStatus })))).toEqual(
      new Set(["pemesanan", "tagihan", "konfirmasi", "lunas"])
    );
  });
});
