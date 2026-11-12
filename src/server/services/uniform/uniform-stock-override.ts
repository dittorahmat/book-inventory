import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { uniformStock, uniformPackageStock } from "../../../db/schema";
import { setVariantStockQuery, setPackageStockQuery } from "./stock";
import { assertDemoStockOverrideActive } from "../demo-stock-override";

export interface UniformVariantStockOverrideInput {
  variantId: string;
  size?: string;
  targetQuantity: number;
}

export interface UniformPackageStockOverrideInput {
  packageId: string;
  targetQuantity: number;
}

/**
 * Override jumlah saldo akhir stok fisik seragam varian (satuan).
 * Guard: mode demo aktif, targetQuantity >= 0.
 * Mutasi melalui seam kanonik setVariantStockQuery.
 */
export async function overrideUniformVariantStock(
  database: AppDatabase,
  input: UniformVariantStockOverrideInput
): Promise<{ success: boolean; previousQuantity: number; newQuantity: number; delta: number }> {
  await assertDemoStockOverrideActive(database);

  const cleanSize = (input.size ?? "—").trim() || "—";

  const [row] = await database
    .select({ quantity: uniformStock.quantity })
    .from(uniformStock)
    .where(and(eq(uniformStock.variantId, input.variantId), eq(uniformStock.size, cleanSize)))
    .limit(1);

  const currentQuantity = row?.quantity ?? 0;
  const delta = input.targetQuantity - currentQuantity;

  await setVariantStockQuery(database, {
    variantId: input.variantId,
    size: cleanSize,
    quantity: input.targetQuantity,
  });

  return {
    success: true,
    previousQuantity: currentQuantity,
    newQuantity: input.targetQuantity,
    delta,
  };
}

/**
 * Override jumlah saldo akhir stok fisik bundel paket seragam.
 * Guard: mode demo aktif, targetQuantity >= 0.
 * Mutasi melalui seam kanonik setPackageStockQuery.
 */
export async function overrideUniformPackageStock(
  database: AppDatabase,
  input: UniformPackageStockOverrideInput
): Promise<{ success: boolean; previousQuantity: number; newQuantity: number; delta: number }> {
  await assertDemoStockOverrideActive(database);

  const [row] = await database
    .select({ quantity: uniformPackageStock.quantity })
    .from(uniformPackageStock)
    .where(eq(uniformPackageStock.packageId, input.packageId))
    .limit(1);

  const currentQuantity = row?.quantity ?? 0;
  const delta = input.targetQuantity - currentQuantity;

  await setPackageStockQuery(database, {
    packageId: input.packageId,
    quantity: input.targetQuantity,
  });

  return {
    success: true,
    previousQuantity: currentQuantity,
    newQuantity: input.targetQuantity,
    delta,
  };
}
