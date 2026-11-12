import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { bookStocks, packageStocks } from "../../../db/schema";
import { moveInventoryStock } from "./movement";
import { assertDemoStockOverrideActive } from "../demo-stock-override";

export interface BookStockOverrideInput {
  schoolId: string;
  bookId: string;
  targetQuantity: number;
  userId?: string;
}

export interface PackageStockOverrideInput {
  schoolId: string;
  packageId: string;
  targetQuantity: number;
  userId?: string;
}

export class AllocationViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AllocationViolationError";
  }
}

/**
 * Override jumlah saldo akhir stok buku satuan.
 * Guard: mode demo aktif, targetQuantity >= reservedQuantity.
 * Mutasi melalui seam kanonik moveInventoryStock (movementType: 'adjustment').
 */
export async function overrideBookStock(
  database: AppDatabase,
  input: BookStockOverrideInput
): Promise<{ success: boolean; previousQuantity: number; newQuantity: number; delta: number; adjustmentId?: string }> {
  await assertDemoStockOverrideActive(database);

  const [row] = await database
    .select({
      available: bookStocks.availableQuantity,
      reserved: bookStocks.reservedQuantity,
    })
    .from(bookStocks)
    .where(and(eq(bookStocks.bookId, input.bookId), eq(bookStocks.schoolId, input.schoolId)))
    .limit(1);

  const currentAvailable = row?.available ?? 0;
  const currentReserved = row?.reserved ?? 0;

  if (input.targetQuantity < currentReserved) {
    throw new AllocationViolationError(
      `Jumlah stok (${input.targetQuantity}) tidak boleh lebih kecil dari pesanan aktif yang teralokasi (${currentReserved}).`
    );
  }

  const delta = input.targetQuantity - currentAvailable;
  if (delta === 0) {
    return {
      success: true,
      previousQuantity: currentAvailable,
      newQuantity: currentAvailable,
      delta: 0,
    };
  }

  const res = await moveInventoryStock(database, {
    movementType: "adjustment",
    itemType: "loose",
    bookId: input.bookId,
    schoolId: input.schoolId,
    quantity: delta,
    reason: "manual_correction",
    notes: `Manual Override (Mode Demo) dari ${currentAvailable} ke ${input.targetQuantity}`,
    adjustedByUserId: input.userId,
    updateStockBalance: true,
  });

  if (!res.ok) {
    throw new Error(res.message || "Gagal melakukan penyesuaian stok buku.");
  }

  return {
    success: true,
    previousQuantity: currentAvailable,
    newQuantity: input.targetQuantity,
    delta,
    adjustmentId: res.adjustmentId,
  };
}

/**
 * Override jumlah saldo akhir stok paket buku.
 * Guard: mode demo aktif, targetQuantity >= reservedQuantity.
 * Mutasi melalui seam kanonik moveInventoryStock (movementType: 'adjustment').
 */
export async function overridePackageStock(
  database: AppDatabase,
  input: PackageStockOverrideInput
): Promise<{ success: boolean; previousQuantity: number; newQuantity: number; delta: number; adjustmentId?: string }> {
  await assertDemoStockOverrideActive(database);

  const [row] = await database
    .select({
      available: packageStocks.availableQuantity,
      reserved: packageStocks.reservedQuantity,
    })
    .from(packageStocks)
    .where(and(eq(packageStocks.packageId, input.packageId), eq(packageStocks.schoolId, input.schoolId)))
    .limit(1);

  const currentAvailable = row?.available ?? 0;
  const currentReserved = row?.reserved ?? 0;

  if (input.targetQuantity < currentReserved) {
    throw new AllocationViolationError(
      `Jumlah stok paket (${input.targetQuantity}) tidak boleh lebih kecil dari pesanan aktif yang teralokasi (${currentReserved}).`
    );
  }

  const delta = input.targetQuantity - currentAvailable;
  if (delta === 0) {
    return {
      success: true,
      previousQuantity: currentAvailable,
      newQuantity: currentAvailable,
      delta: 0,
    };
  }

  const res = await moveInventoryStock(database, {
    movementType: "adjustment",
    itemType: "package",
    packageId: input.packageId,
    schoolId: input.schoolId,
    quantity: delta,
    reason: "manual_correction",
    notes: `Manual Override (Mode Demo) dari ${currentAvailable} ke ${input.targetQuantity}`,
    adjustedByUserId: input.userId,
    updateStockBalance: true,
  });

  if (!res.ok) {
    throw new Error(res.message || "Gagal melakukan penyesuaian stok paket buku.");
  }

  return {
    success: true,
    previousQuantity: currentAvailable,
    newQuantity: input.targetQuantity,
    delta,
    adjustmentId: res.adjustmentId,
  };
}
