import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { uniformPackageStock, uniformStock } from "../../../db/schema";
import { newWriteId, writeNow, type WriteDeps } from "../../lib/d1-write";

/**
 * Satu-satunya mutator stok seragam. Perbedaan "baris wajib ada", "buat bila
 * hilang", dan "lewati bila hilang" adalah kebijakan yang dinamai di call site,
 * bukan lima salinan update/insert dengan perilaku berbeda diam-diam.
 */
export type StockPolicy = "require" | "create" | "skip";

export interface VariantStockChange {
  variantId: string;
  size: string;
  delta: number;
}

export interface PackageStockChange {
  packageId: string;
  delta: number;
}

/** Query builder hidup: perubahan stok varian-size (delta, bukan nilai absolut). */
export const adjustVariantStockQuery = (
  database: AppDatabase,
  change: VariantStockChange,
  policy: StockPolicy,
  deps?: WriteDeps
) => {
  const now = writeNow(deps);
  const nextQuantity = sql`${uniformStock.quantity} + ${change.delta}`;
  if (policy === "create") {
    return database
      .insert(uniformStock)
      .values({
        id: newWriteId(deps),
        variantId: change.variantId,
        size: change.size,
        quantity: change.delta,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [uniformStock.variantId, uniformStock.size],
        set: { quantity: nextQuantity, updatedAt: now },
      });
  }
  return database
    .update(uniformStock)
    .set({ quantity: nextQuantity, updatedAt: now })
    .where(and(eq(uniformStock.variantId, change.variantId), eq(uniformStock.size, change.size)));
};

/** Query builder hidup: perubahan stok paket rakitan (delta). */
export const adjustPackageStockQuery = (
  database: AppDatabase,
  change: PackageStockChange,
  policy: StockPolicy,
  deps?: WriteDeps
) => {
  const now = writeNow(deps);
  const nextQuantity = sql`${uniformPackageStock.quantity} + ${change.delta}`;
  if (policy === "create") {
    return database
      .insert(uniformPackageStock)
      .values({
        id: newWriteId(deps),
        packageId: change.packageId,
        quantity: change.delta,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: uniformPackageStock.packageId,
        set: { quantity: nextQuantity, updatedAt: now },
      });
  }
  return database
    .update(uniformPackageStock)
    .set({ quantity: nextQuantity, updatedAt: now })
    .where(eq(uniformPackageStock.packageId, change.packageId));
};

/** Stok manual mode "set": upsert nilai absolut (bukan delta). */
export const setVariantStockQuery = (
  database: AppDatabase,
  input: { variantId: string; size: string; quantity: number },
  deps?: WriteDeps
) => {
  const now = writeNow(deps);
  return database
    .insert(uniformStock)
    .values({
      id: newWriteId(deps),
      variantId: input.variantId,
      size: input.size,
      quantity: input.quantity,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [uniformStock.variantId, uniformStock.size],
      set: { quantity: input.quantity, updatedAt: now },
    });
};
