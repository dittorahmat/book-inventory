import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { uniformStock, uniformPackageStock, uniformOrders, uniformOrderItems } from "../../../db/schema";
import { setVariantStockQuery, setPackageStockQuery } from "./stock";
import { assertDemoStockOverrideActive } from "../demo-stock-override";
import { AllocationViolationError } from "../stock/book-stock-override";

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
 * Guard: mode demo aktif, targetQuantity >= pesanan aktif (belum dikirim & not unpaid).
 * Mutasi melalui seam kanonik setVariantStockQuery.
 */
export async function overrideUniformVariantStock(
  database: AppDatabase,
  input: UniformVariantStockOverrideInput
): Promise<{ success: boolean; previousQuantity: number; newQuantity: number; delta: number }> {
  await assertDemoStockOverrideActive(database);

  const cleanSize = (input.size ?? "—").trim() || "—";

  // Cek alokasi pesanan aktif yang belum dikirim
  const [activeAlloc] = await database
    .select({
      reserved: sql<number>`coalesce(sum(${uniformOrderItems.quantity}), 0)`,
    })
    .from(uniformOrderItems)
    .innerJoin(uniformOrders, eq(uniformOrderItems.orderId, uniformOrders.id))
    .where(
      and(
        eq(uniformOrderItems.variantId, input.variantId),
        eq(uniformOrderItems.size, cleanSize),
        eq(uniformOrders.shipmentStatus, "belum_dikirim"),
        sql`${uniformOrders.paymentStatus} != 'unpaid'`
      )
    );

  const reservedQuantity = Number(activeAlloc?.reserved ?? 0);
  if (input.targetQuantity < reservedQuantity) {
    throw new AllocationViolationError(
      `Jumlah stok seragam (${input.targetQuantity}) tidak boleh lebih kecil dari pesanan aktif yang teralokasi (${reservedQuantity}).`
    );
  }

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
 * Guard: mode demo aktif, targetQuantity >= pesanan aktif (belum dikirim & not unpaid).
 * Mutasi melalui seam kanonik setPackageStockQuery.
 */
export async function overrideUniformPackageStock(
  database: AppDatabase,
  input: UniformPackageStockOverrideInput
): Promise<{ success: boolean; previousQuantity: number; newQuantity: number; delta: number }> {
  await assertDemoStockOverrideActive(database);

  // Cek alokasi pesanan aktif paket yang belum dikirim
  const [activeAlloc] = await database
    .select({
      reserved: sql<number>`coalesce(sum(${uniformOrderItems.quantity}), 0)`,
    })
    .from(uniformOrderItems)
    .innerJoin(uniformOrders, eq(uniformOrderItems.orderId, uniformOrders.id))
    .where(
      and(
        eq(uniformOrderItems.packageId, input.packageId),
        eq(uniformOrders.shipmentStatus, "belum_dikirim"),
        sql`${uniformOrders.paymentStatus} != 'unpaid'`
      )
    );

  const reservedQuantity = Number(activeAlloc?.reserved ?? 0);
  if (input.targetQuantity < reservedQuantity) {
    throw new AllocationViolationError(
      `Jumlah stok paket seragam (${input.targetQuantity}) tidak boleh lebih kecil dari pesanan aktif yang teralokasi (${reservedQuantity}).`
    );
  }

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
