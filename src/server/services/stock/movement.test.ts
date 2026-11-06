import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import { bookStocks, packageStocks, stockAdjustments } from "../../../db/schema";
import { moveInventoryStock } from "./movement";
import { ensurePackageStockRow } from "./aggregate";

describe("moveInventoryStock deep engine (Ticket 01)", () => {
  const seedPrefix = `t1_${Date.now()}`;
  const schoolA = `${seedPrefix}_sch_a`;
  const schoolB = `${seedPrefix}_sch_b`;
  const bookId = `${seedPrefix}_bk_1`;
  const packageId = `${seedPrefix}_pkg_1`;

  it("handles receipt movement by crediting available balance", async () => {
    const res = await moveInventoryStock(db, {
      movementType: "receipt",
      itemType: "loose",
      bookId,
      toSchoolId: schoolA,
      quantity: 15,
    });

    expect(res.ok).toBe(true);
    const [row] = await db
      .select({ qty: bookStocks.availableQuantity })
      .from(bookStocks)
      .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolA)));
    expect(row.qty).toBe(15);
  });

  it("handles handover movement by debiting available balance and blocks when insufficient", async () => {
    // Handover valid
    const valid = await moveInventoryStock(db, {
      movementType: "handover",
      itemType: "loose",
      bookId,
      schoolId: schoolA,
      quantity: 5,
    });
    expect(valid.ok).toBe(true);

    const [row] = await db
      .select({ qty: bookStocks.availableQuantity })
      .from(bookStocks)
      .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolA)));
    expect(row.qty).toBe(10);

    // Handover melebihi stok
    const invalid = await moveInventoryStock(db, {
      movementType: "handover",
      itemType: "loose",
      bookId,
      schoolId: schoolA,
      quantity: 20,
    });
    expect(invalid.ok).toBe(false);
  });

  it("handles atomic transfer between schools", async () => {
    const res = await moveInventoryStock(db, {
      movementType: "transfer",
      itemType: "loose",
      bookId,
      fromSchoolId: schoolA,
      toSchoolId: schoolB,
      quantity: 4,
    });
    expect(res.ok).toBe(true);

    const [rowA] = await db
      .select({ qty: bookStocks.availableQuantity })
      .from(bookStocks)
      .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolA)));
    expect(rowA.qty).toBe(6);

    const [rowB] = await db
      .select({ qty: bookStocks.availableQuantity })
      .from(bookStocks)
      .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolB)));
    expect(rowB.qty).toBe(4);
  });

  it("handles package assembly and disassembly", async () => {
    await ensurePackageStockRow(db, packageId, schoolA);

    const asm = await moveInventoryStock(db, {
      movementType: "assembly",
      itemType: "package",
      packageId,
      schoolId: schoolA,
      quantity: 8,
    });
    expect(asm.ok).toBe(true);

    const [row] = await db
      .select({ qty: packageStocks.availableQuantity })
      .from(packageStocks)
      .where(and(eq(packageStocks.packageId, packageId), eq(packageStocks.schoolId, schoolA)));
    expect(row.qty).toBe(8);

    const disasm = await moveInventoryStock(db, {
      movementType: "disassembly",
      itemType: "package",
      packageId,
      schoolId: schoolA,
      quantity: 3,
    });
    expect(disasm.ok).toBe(true);

    const [rowAfter] = await db
      .select({ qty: packageStocks.availableQuantity })
      .from(packageStocks)
      .where(and(eq(packageStocks.packageId, packageId), eq(packageStocks.schoolId, schoolA)));
    expect(rowAfter.qty).toBe(5);
  });

  it("records adjustment with audit log", async () => {
    const adj = await moveInventoryStock(db, {
      movementType: "adjustment",
      itemType: "loose",
      bookId,
      schoolId: schoolA,
      quantity: -2,
      reason: "damaged",
      notes: "Rusak saat penataan rak",
    });
    expect(adj.ok).toBe(true);
    expect(adj.adjustmentId).toBeDefined();

    const [log] = await db
      .select()
      .from(stockAdjustments)
      .where(eq(stockAdjustments.id, adj.adjustmentId!));
    expect(log.reason).toBe("damaged");
    expect(log.quantity).toBe(-2);
  });

  it("handles transfer_discrepancy (debits origin, logs adjustment at destination without increasing available)", async () => {
    // Current stock: bookId at schoolA = 7 (from initial 10, transfer 3 -> left 7)
    // Let's verify before
    const [beforeA] = await db
      .select({ qty: bookStocks.availableQuantity })
      .from(bookStocks)
      .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolA)));
    const startQtyA = beforeA.qty;

    const res = await moveInventoryStock(db, {
      movementType: "transfer_discrepancy",
      itemType: "loose",
      bookId,
      fromSchoolId: schoolA,
      toSchoolId: schoolB,
      quantity: 1,
      reason: "damaged",
      referenceDocumentNumber: "TRF-TEST-001",
      notes: "Rusak saat transit ekspedisi",
    });

    expect(res.ok).toBe(true);
    expect(res.adjustmentId).toBeDefined();

    // Origin must be debited by 1
    const [afterA] = await db
      .select({ qty: bookStocks.availableQuantity })
      .from(bookStocks)
      .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolA)));
    expect(afterA.qty).toBe(startQtyA - 1);

    // Destination available must NOT increase (it remains 4 from previous transfer)
    const [afterB] = await db
      .select({ qty: bookStocks.availableQuantity })
      .from(bookStocks)
      .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolB)));
    expect(afterB.qty).toBe(4);

    // Audit log recorded at schoolB
    const [log] = await db
      .select()
      .from(stockAdjustments)
      .where(eq(stockAdjustments.id, res.adjustmentId!));
    expect(log.schoolId).toBe(schoolB);
    expect(log.reason).toBe("damaged");
    expect(log.quantity).toBe(-1);
    expect(log.referenceDocumentNumber).toBe("TRF-TEST-001");
  });
});
