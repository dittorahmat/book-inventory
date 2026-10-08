import { describe, expect, it } from "bun:test";
import { db } from "../../db";
import { bookItems, books, schools } from "../../db/schema";
import { eq } from "drizzle-orm";
import {
  addLoose,
  addPackage,
  newLooseTally,
  newPackageTally,
  tallyLoose,
  tallyPackages,
} from "./stock-kernel";
import { getLooseStockSummary } from "./stock-summary";
import { dashboardRouter } from "../routes/dashboard";

describe("stock-kernel tallies", () => {
  it("counts mixed loose rows once under one rule", () => {
    const tally = tallyLoose([
      { status: "in_stock", condition: "new" },
      { status: "in_stock", condition: "good" },
      { status: "in_transit", condition: "new" },
      { status: "lost", condition: "good" },
      { status: "disposed", condition: "damaged" },
    ]);
    expect(tally.totalQty).toBe(4);
    expect(tally.availableQty).toBe(2);
    expect(tally.inTransitQty).toBe(1);
    expect(tally.lostQty).toBe(1);
    expect(tally.damagedQty).toBe(0);
    expect(tally.byConditionAll).toEqual({ new: 2, good: 2, fair: 0, damaged: 1 });
    expect(tally.byConditionAvailable).toEqual({ new: 1, good: 1, fair: 0, damaged: 0 });
    expect(tally.byStatus).toEqual({ in_stock: 2, in_transit: 1, disposed: 1, lost: 1 });
  });

  it("counts available damaged for attention and ignores unknown keys", () => {
    const tally = newLooseTally();
    addLoose(tally, { status: "in_stock", condition: "damaged" });
    addLoose(tally, { status: "weird-status", condition: "weird-condition" });
    expect(tally.damagedQty).toBe(1);
    expect(tally.totalQty).toBe(2);
    expect(tally.availableQty).toBe(1);
    expect(tally.byStatus).toEqual({ in_stock: 1, in_transit: 0, disposed: 0, lost: 0 });
  });

  it("returns zeroed empty states for empty input", () => {
    expect(tallyLoose([])).toMatchObject({ totalQty: 0, availableQty: 0, inTransitQty: 0, lostQty: 0, damagedQty: 0 });
    expect(tallyPackages([])).toMatchObject({ totalQty: 0, readyQty: 0 });
  });

  it("counts bundles with ready rule", () => {
    const tally = newPackageTally();
    addPackage(tally, { status: "in_stock" });
    addPackage(tally, { status: "reserved" });
    addPackage(tally, { status: "dispatched" });
    expect(tally.totalQty).toBe(3);
    expect(tally.readyQty).toBe(1);
    expect(tally.byStatus).toEqual({ in_stock: 1, reserved: 1, dispatched: 1, delivered: 0 });
  });
});

describe("stock parity dashboard vs inventory (T3)", () => {
  it("per-title totals match between dashboard byTitle and inventory summary", async () => {
    const now = new Date().toISOString();
    const schoolId = `sch-parity-${Date.now()}`;
    const bookId = `bk-parity-${Date.now()}`;
    try {
      await db.insert(schools).values({
        id: schoolId, name: "Parity School", code: `PAR-${Date.now()}`, type: "branch",
        createdAt: now, updatedAt: now,
      });
      await db.insert(books).values({
        id: bookId, isbn: `ISBN-PAR-${Date.now()}`, title: "Parity Book", author: "QA",
        publisher: "QA Press", price: 10000, sellPrice: 15000, createdAt: now, updatedAt: now,
      });
      const copies: Array<{ id: string; condition: "new" | "good"; status: "in_stock" | "in_transit" | "lost" }> = [
        { id: `bi-p1-${Date.now()}`, condition: "new", status: "in_stock" },
        { id: `bi-p2-${Date.now()}`, condition: "good", status: "in_stock" },
        { id: `bi-p3-${Date.now()}`, condition: "new", status: "in_transit" },
        { id: `bi-p4-${Date.now()}`, condition: "good", status: "lost" },
      ];
      for (const c of copies) {
        await db.insert(bookItems).values({
          id: c.id, bookId, currentSchoolId: schoolId, barcode: `PAR-${c.id}`,
          condition: c.condition, status: c.status, createdAt: now, updatedAt: now,
        });
      }

      const invRows = await getLooseStockSummary([schoolId]);
      const inv = invRows.find((r) => r.bookId === bookId);
      expect(inv?.totalQty).toBe(4);
      expect(inv?.availableQty).toBe(2);
      expect(inv?.inTransitQty).toBe(1);

      const dashRes = await dashboardRouter.request(`/summary?schoolId=${schoolId}`, { method: "GET" });
      expect(dashRes.status).toBe(200);
      const [s] = (await dashRes.json()).data.schools;
      const title = s.stock.byTitle.find((t: { bookId: string }) => t.bookId === bookId);
      expect(title.totalQty).toBe(inv?.totalQty);
      expect(title.availableQty).toBe(inv?.availableQty);
      expect(title.inTransitQty).toBe(inv?.inTransitQty);
      expect(s.stock.looseInStock).toBe(inv?.availableQty);
    } finally {
      await db.delete(bookItems).where(eq(bookItems.currentSchoolId, schoolId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});
