import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import { uniformStock, uniformPackageStock, uniformVariants, uniformPackages, systemSettings } from "../../../db/schema";
import { DEMO_STOCK_OVERRIDE_KEY, setDemoStockOverrideEnabled } from "../demo-stock-override";
import { overrideUniformVariantStock, overrideUniformPackageStock } from "./uniform-stock-override";

describe("uniform-stock-override service", () => {
  const stamp = Date.now().toString().slice(-6);
  const variantId = `uv-${stamp}`;
  const packageId = `up-${stamp}`;

  beforeEach(async () => {
    await db.delete(systemSettings).where(eq(systemSettings.key, DEMO_STOCK_OVERRIDE_KEY));

    await db.insert(uniformVariants).values({
      id: variantId,
      code: `UV${stamp}`,
      name: `Uniform Variant ${stamp}`,
      kind: "olahraga",
      gender: "male",
      jenjang: "sd",
      academicYear: "2026/2027",
      price: 100000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(uniformPackages).values({
      id: packageId,
      code: `UP${stamp}`,
      name: `Uniform Package ${stamp}`,
      academicYear: "2026/2027",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(async () => {
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
});
