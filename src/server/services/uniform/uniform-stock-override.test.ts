import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  uniformStock,
  uniformPackageStock,
  uniformVariants,
  uniformPackages,
  uniformOrders,
  uniformOrderItems,
  systemSettings,
} from "../../../db/schema";
import { DEMO_STOCK_OVERRIDE_KEY, setDemoStockOverrideEnabled } from "../demo-stock-override";
import { overrideUniformVariantStock, overrideUniformPackageStock } from "./uniform-stock-override";
import { AllocationViolationError } from "../stock/book-stock-override";
import { createTestUniformVariant, createTestUniformPackage, createTestStudent, createTestSchool } from "../../lib/test-fixtures";

describe("uniform-stock-override service", () => {
  let variantId = "";
  let packageId = "";
  let schoolId = "";
  let studentId = "";
  let orderId = "";

  beforeEach(async () => {
    await db.delete(systemSettings).where(eq(systemSettings.key, DEMO_STOCK_OVERRIDE_KEY));

    const sch = await createTestSchool(db);
    schoolId = sch.id;
    const stu = await createTestStudent(db, { schoolId });
    studentId = stu.id;
    const uv = await createTestUniformVariant(db);
    variantId = uv.id;
    const upkg = await createTestUniformPackage(db);
    packageId = upkg.id;
  });

  afterEach(async () => {
    if (orderId) {
      await db.delete(uniformOrderItems).where(eq(uniformOrderItems.orderId, orderId));
      await db.delete(uniformOrders).where(eq(uniformOrders.id, orderId));
    }
    await db.delete(uniformStock).where(eq(uniformStock.variantId, variantId));
    await db.delete(uniformPackageStock).where(eq(uniformPackageStock.packageId, packageId));
    await db.delete(uniformVariants).where(eq(uniformVariants.id, variantId));
    await db.delete(uniformPackages).where(eq(uniformPackages.id, packageId));
  });

  it("fails when demo mode is disabled", async () => {
    expect(
      overrideUniformVariantStock(db, { variantId, size: "M", targetQuantity: 30 })
    ).rejects.toThrow("Mode override stok demo sedang nonaktif");

    expect(
      overrideUniformPackageStock(db, { packageId, targetQuantity: 20 })
    ).rejects.toThrow("Mode override stok demo sedang nonaktif");
  });

  it("overrides uniform variant stock and package stock when demo mode enabled", async () => {
    await setDemoStockOverrideEnabled(db, true);

    const resVar = await overrideUniformVariantStock(db, { variantId, size: "M", targetQuantity: 35 });
    expect(resVar.success).toBe(true);
    expect(resVar.previousQuantity).toBe(0);
    expect(resVar.newQuantity).toBe(35);
    expect(resVar.delta).toBe(35);

    const [stkVar] = await db
      .select()
      .from(uniformStock)
      .where(and(eq(uniformStock.variantId, variantId), eq(uniformStock.size, "M")));
    expect(stkVar?.quantity).toBe(35);

    // Override paket seragam
    const resPkg = await overrideUniformPackageStock(db, { packageId, targetQuantity: 18 });
    expect(resPkg.success).toBe(true);
    expect(resPkg.previousQuantity).toBe(0);
    expect(resPkg.newQuantity).toBe(18);

    const [stkPkg] = await db
      .select()
      .from(uniformPackageStock)
      .where(eq(uniformPackageStock.packageId, packageId));
    expect(stkPkg?.quantity).toBe(18);
  });

  it("rejects override when target quantity is lower than active pending orders", async () => {
    await setDemoStockOverrideEnabled(db, true);

    const now = new Date().toISOString();
    orderId = `uord-test-${Date.now()}`;
    await db.insert(uniformOrders).values({
      id: orderId,
      orderNumber: `ORD-${Date.now()}`,
      studentId,
      schoolId,
      academicYear: "2026/2027",
      homeAddressSnapshot: "Jl. Test No. 1",
      shipmentStatus: "belum_dikirim",
      paymentStatus: "paid",
      totalAmount: 150000,
      paidAmount: 150000,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(uniformOrderItems).values([
      {
        id: `uitem-1-${Date.now()}`,
        orderId,
        variantId,
        size: "M",
        quantity: 5,
        createdAt: now,
      },
      {
        id: `uitem-2-${Date.now()}`,
        orderId,
        packageId,
        quantity: 3,
        size: "—",
        createdAt: now,
      },
    ]);

    // Target untuk variant < 5 harus throw AllocationViolationError
    expect(
      overrideUniformVariantStock(db, { variantId, size: "M", targetQuantity: 4 })
    ).rejects.toThrow(AllocationViolationError);

    // Target untuk package < 3 harus throw AllocationViolationError
    expect(
      overrideUniformPackageStock(db, { packageId, targetQuantity: 2 })
    ).rejects.toThrow(AllocationViolationError);

    // Target >= alokasi aktif harus sukses
    const resVar = await overrideUniformVariantStock(db, { variantId, size: "M", targetQuantity: 5 });
    expect(resVar.success).toBe(true);
    expect(resVar.newQuantity).toBe(5);

    const resPkg = await overrideUniformPackageStock(db, { packageId, targetQuantity: 3 });
    expect(resPkg.success).toBe(true);
    expect(resPkg.newQuantity).toBe(3);
  });
});
