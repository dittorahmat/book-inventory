import { describe, expect, it, afterEach } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { books, bookStocks, packageStocks, schools, bookPackages, stockAdjustments } from "../../../db/schema";
import {
  adjustLooseStock,
  adjustPackageStock,
  ensureBookStockRow,
  ensurePackageStockRow,
  recordStockAdjustment,
} from "./aggregate";

describe("stock aggregate seam (Ticket 1)", () => {
  it("ensures book stock row and adjusts available quantity", async () => {
    const stamp = Date.now();
    const schoolId = `sch-agg-${stamp}`;
    const bookId = `bk-agg-${stamp}`;

    await db.insert(schools).values({
      id: schoolId,
      name: `School ${stamp}`,
      code: `SCH-${stamp}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(books).values({
      id: bookId,
      title: `Book ${stamp}`,
      author: "Author Test",
      publisher: "Publisher Test",
      isbn: `ISBN-${stamp}`,
      price: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 1. Initial ensure
    await ensureBookStockRow(db, bookId, schoolId);
    const [row1] = await db.select().from(bookStocks).where(eq(bookStocks.bookId, bookId));
    expect(row1).toBeDefined();
    expect(row1.availableQuantity).toBe(0);

    // 2. Adjust positive (inbound +10)
    const addRes = await adjustLooseStock(db, bookId, schoolId, 10);
    expect(addRes.ok).toBe(true);
    expect(addRes.newAvailable).toBe(10);

    // 3. Adjust negative within bounds (-4)
    const subRes = await adjustLooseStock(db, bookId, schoolId, -4);
    expect(subRes.ok).toBe(true);
    expect(subRes.newAvailable).toBe(6);

    // 4. Adjust negative exceeding bounds (-10 -> should fail gracefully)
    const failRes = await adjustLooseStock(db, bookId, schoolId, -10);
    expect(failRes.ok).toBe(false);
    expect(failRes.newAvailable).toBe(6);
  });

  it("handles package stock adjustments", async () => {
    const stamp = Date.now();
    const schoolId = `sch-pkg-${stamp}`;
    const packageId = `pkg-agg-${stamp}`;

    await db.insert(schools).values({
      id: schoolId,
      name: `School Pkg ${stamp}`,
      code: `SCHP-${stamp}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(bookPackages).values({
      id: packageId,
      name: `Package ${stamp}`,
      code: `PKG-${stamp}`,
      curriculumType: "INTER",
      gradeLevel: "1",
      academicYear: "2026/2027",
      price: 250000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await ensurePackageStockRow(db, packageId, schoolId);
    const addRes = await adjustPackageStock(db, packageId, schoolId, 5);
    expect(addRes.ok).toBe(true);
    expect(addRes.newAvailable).toBe(5);

    const [row] = await db.select().from(packageStocks).where(eq(packageStocks.packageId, packageId));
    expect(row.availableQuantity).toBe(5);
  });

  it("records stock adjustment with write-off and audit log", async () => {
    const stamp = Date.now();
    const schoolId = `sch-adj-${stamp}`;
    const bookId = `bk-adj-${stamp}`;

    await db.insert(schools).values({
      id: schoolId,
      name: `School Adj ${stamp}`,
      code: `SCHA-${stamp}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(books).values({
      id: bookId,
      title: `Book Adj ${stamp}`,
      author: "Author Adj",
      publisher: "Publisher Adj",
      isbn: `ISBNA-${stamp}`,
      price: 75000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Inbound 10
    await adjustLooseStock(db, bookId, schoolId, 10);

    // Write-off 2 damaged books
    const adjRes = await recordStockAdjustment(db, {
      schoolId,
      itemType: "loose",
      bookId,
      quantity: -2,
      reason: "damaged",
      referenceDocumentNumber: "BA-RECON-001",
      notes: "Buku basah saat pengiriman",
    });

    expect(adjRes.ok).toBe(true);
    expect(adjRes.adjustmentId).toBeTruthy();

    const [stock] = await db.select().from(bookStocks).where(eq(bookStocks.bookId, bookId));
    expect(stock.availableQuantity).toBe(8);

    const [adjLog] = await db.select().from(stockAdjustments).where(eq(stockAdjustments.id, adjRes.adjustmentId));
    expect(adjLog.reason).toBe("damaged");
    expect(adjLog.quantity).toBe(-2);
    expect(adjLog.referenceDocumentNumber).toBe("BA-RECON-001");
  });

  afterEach(async () => {
    await db.delete(stockAdjustments);
    await db.delete(bookStocks);
    await db.delete(packageStocks);
    await db.delete(bookPackages);
    await db.delete(books);
    await db.delete(schools);
  });
});
