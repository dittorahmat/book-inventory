import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import { books, bookPackages, bookStocks, packageStocks, schools, stockAdjustments, systemSettings } from "../../../db/schema";
import { DEMO_STOCK_OVERRIDE_KEY, setDemoStockOverrideEnabled } from "../demo-stock-override";
import { overrideBookStock, overridePackageStock, AllocationViolationError } from "./book-stock-override";
import { createTestBook, createTestPackage, createTestSchool } from "../../lib/test-fixtures";

describe("book-stock-override service", () => {
  let schoolId = "";
  let bookId = "";
  let packageId = "";

  beforeEach(async () => {
    await db.delete(systemSettings).where(eq(systemSettings.key, DEMO_STOCK_OVERRIDE_KEY));

    const s = await createTestSchool(db);
    schoolId = s.id;
    const b = await createTestBook(db);
    bookId = b.id;
    const p = await createTestPackage(db);
    packageId = p.id;
  });

  afterEach(async () => {
    if (schoolId) {
      await db.delete(stockAdjustments).where(eq(stockAdjustments.schoolId, schoolId));
      await db.delete(bookStocks).where(eq(bookStocks.schoolId, schoolId));
      await db.delete(packageStocks).where(eq(packageStocks.schoolId, schoolId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
    if (bookId) {
      await db.delete(books).where(eq(books.id, bookId));
    }
    if (packageId) {
      await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
    }
  });

  it("fails when demo mode is disabled", async () => {
    expect(
      overrideBookStock(db, { schoolId, bookId, targetQuantity: 50 })
    ).rejects.toThrow("Mode override stok demo sedang nonaktif");

    expect(
      overridePackageStock(db, { schoolId, packageId, targetQuantity: 50 })
    ).rejects.toThrow("Mode override stok demo sedang nonaktif");
  });

  it("overrides book stock and logs adjustment when enabled", async () => {
    await setDemoStockOverrideEnabled(db, true);

    const res1 = await overrideBookStock(db, { schoolId, bookId, targetQuantity: 50 });
    expect(res1.success).toBe(true);
    expect(res1.previousQuantity).toBe(0);
    expect(res1.newQuantity).toBe(50);
    expect(res1.delta).toBe(50);

    const [stk1] = await db
      .select()
      .from(bookStocks)
      .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolId)));
    expect(stk1?.availableQuantity).toBe(50);

    // Override lagi ke 30
    const res2 = await overrideBookStock(db, { schoolId, bookId, targetQuantity: 30 });
    expect(res2.success).toBe(true);
    expect(res2.previousQuantity).toBe(50);
    expect(res2.newQuantity).toBe(30);
    expect(res2.delta).toBe(-20);

    const [stk2] = await db
      .select()
      .from(bookStocks)
      .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolId)));
    expect(stk2?.availableQuantity).toBe(30);

    // Verifikasi log stock_adjustments
    const adjs = await db
      .select()
      .from(stockAdjustments)
      .where(and(eq(stockAdjustments.schoolId, schoolId), eq(stockAdjustments.bookId, bookId)));
    expect(adjs.length).toBe(2);
  });

  it("blocks overriding book stock below reserved quantity", async () => {
    await setDemoStockOverrideEnabled(db, true);

    // Buat initial row dengan reservedQuantity = 10
    const stamp = Date.now().toString().slice(-6);
    await db.insert(bookStocks).values({
      id: `bstk-${stamp}`,
      bookId,
      schoolId,
      availableQuantity: 15,
      reservedQuantity: 10,
      updatedAt: new Date().toISOString(),
    });

    expect(
      overrideBookStock(db, { schoolId, bookId, targetQuantity: 5 })
    ).rejects.toThrow(AllocationViolationError);

    // Target >= reserved (10) dibolehkan
    const ok = await overrideBookStock(db, { schoolId, bookId, targetQuantity: 10 });
    expect(ok.newQuantity).toBe(10);
  });

  it("overrides package stock correctly", async () => {
    await setDemoStockOverrideEnabled(db, true);

    const res = await overridePackageStock(db, { schoolId, packageId, targetQuantity: 25 });
    expect(res.success).toBe(true);
    expect(res.newQuantity).toBe(25);

    const [pstk] = await db
      .select()
      .from(packageStocks)
      .where(and(eq(packageStocks.packageId, packageId), eq(packageStocks.schoolId, schoolId)));
    expect(pstk?.availableQuantity).toBe(25);
  });
});
