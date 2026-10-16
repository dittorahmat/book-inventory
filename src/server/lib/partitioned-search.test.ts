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
});
