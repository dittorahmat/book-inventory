import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { bookStocks, packageStocks, stockAdjustments } from "../../../db/schema";
import { newWriteId, writeNow, type WriteDeps } from "../../lib/d1-write";

export interface BookStockLine {
  kind: "loose" | "package";
  targetId: string; // bookId atau packageId
  schoolId: string;
  quantity: number;
}

export interface StockAdjustmentInput {
  schoolId: string;
  itemType: "loose" | "package";
  bookId?: string;
  packageId?: string;
  quantity: number; // negatif = write-off/rusak/hilang, positif = penambahan/koreksi opname
  reason: "damaged" | "missing" | "audit_reconciliation" | "manual_correction";
  referenceDocumentNumber?: string;
  notes?: string;
  adjustedByUserId?: string;
}

/**
 * Pastikan baris book_stocks ada (insert if not exists 0).
 */
export async function ensureBookStockRow(
  database: AppDatabase,
  bookId: string,
  schoolId: string,
  deps: WriteDeps = {}
): Promise<void> {
  const [existing] = await database
    .select({ id: bookStocks.id })
    .from(bookStocks)
    .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolId)));

  if (!existing) {
    const now = writeNow(deps);
    await database.insert(bookStocks).values({
      id: newWriteId(deps),
      bookId,
      schoolId,
      availableQuantity: 0,
      reservedQuantity: 0,
      updatedAt: now,
    }).onConflictDoNothing();
  }
}

/**
 * Pastikan baris package_stocks ada (insert if not exists 0).
 */
export async function ensurePackageStockRow(
  database: AppDatabase,
  packageId: string,
  schoolId: string,
  deps: WriteDeps = {}
): Promise<void> {
  const [existing] = await database
    .select({ id: packageStocks.id })
    .from(packageStocks)
    .where(and(eq(packageStocks.packageId, packageId), eq(packageStocks.schoolId, schoolId)));

  if (!existing) {
    const now = writeNow(deps);
    await database.insert(packageStocks).values({
      id: newWriteId(deps),
      packageId,
      schoolId,
      availableQuantity: 0,
      reservedQuantity: 0,
      updatedAt: now,
    }).onConflictDoNothing();
  }
}

/**
 * Mutasi saldo buku satuan (+/- available_quantity).
 */
export async function adjustLooseStock(
  database: AppDatabase,
  bookId: string,
  schoolId: string,
  delta: number,
  deps: WriteDeps = {}
): Promise<{ ok: boolean; newAvailable: number }> {
  await ensureBookStockRow(database, bookId, schoolId, deps);
  const now = writeNow(deps);
  
  // Dapatkan saldo saat ini
  const [row] = await database
    .select({ available: bookStocks.availableQuantity })
    .from(bookStocks)
    .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolId)));

  const current = row?.available ?? 0;
  if (delta < 0 && current + delta < 0) {
    return { ok: false, newAvailable: current };
  }

  await database
    .update(bookStocks)
    .set({
      availableQuantity: sql`${bookStocks.availableQuantity} + ${delta}`,
      updatedAt: now,
    })
    .where(and(eq(bookStocks.bookId, bookId), eq(bookStocks.schoolId, schoolId)));

  return { ok: true, newAvailable: current + delta };
}

/**
 * Mutasi saldo paket buku (+/- available_quantity).
 */
export async function adjustPackageStock(
  database: AppDatabase,
  packageId: string,
  schoolId: string,
  delta: number,
  deps: WriteDeps = {}
): Promise<{ ok: boolean; newAvailable: number }> {
  await ensurePackageStockRow(database, packageId, schoolId, deps);
  const now = writeNow(deps);

  const [row] = await database
    .select({ available: packageStocks.availableQuantity })
    .from(packageStocks)
    .where(and(eq(packageStocks.packageId, packageId), eq(packageStocks.schoolId, schoolId)));

  const current = row?.available ?? 0;
  if (delta < 0 && current + delta < 0) {
    return { ok: false, newAvailable: current };
  }

  await database
    .update(packageStocks)
    .set({
      availableQuantity: sql`${packageStocks.availableQuantity} + ${delta}`,
      updatedAt: now,
    })
    .where(and(eq(packageStocks.packageId, packageId), eq(packageStocks.schoolId, schoolId)));

  return { ok: true, newAvailable: current + delta };
}

/**
 * Catat audit penyesuaian stok (write-off rusak/hilang atau opname) sekaligus update saldo stok.
 * Jika updateStockBalance bernilai false (misal intake barang rusak yang belum masuk available_quantity),
 * mutasi saldo dilewati dan audit log tetap dicatat.
 */
export async function recordStockAdjustment(
  database: AppDatabase,
  input: StockAdjustmentInput & { updateStockBalance?: boolean },
  deps: WriteDeps = {}
): Promise<{ ok: boolean; adjustmentId: string }> {
  const now = writeNow(deps);
  const adjustmentId = newWriteId(deps);
  const shouldUpdateBalance = input.updateStockBalance ?? true;

  if (shouldUpdateBalance) {
    if (input.itemType === "loose") {
      if (!input.bookId) throw new Error("bookId wajib untuk penyesuaian stok satuan loose");
      const adjustRes = await adjustLooseStock(database, input.bookId, input.schoolId, input.quantity, deps);
      if (!adjustRes.ok) {
        return { ok: false, adjustmentId: "" };
      }
    } else {
      if (!input.packageId) throw new Error("packageId wajib untuk penyesuaian stok paket");
      const adjustRes = await adjustPackageStock(database, input.packageId, input.schoolId, input.quantity, deps);
      if (!adjustRes.ok) {
        return { ok: false, adjustmentId: "" };
      }
    }
  }

  await database.insert(stockAdjustments).values({
    id: adjustmentId,
    schoolId: input.schoolId,
    itemType: input.itemType,
    bookId: input.bookId ?? null,
    packageId: input.packageId ?? null,
    quantity: input.quantity,
    reason: input.reason,
    referenceDocumentNumber: input.referenceDocumentNumber ?? null,
    notes: input.notes ?? null,
    adjustedByUserId: input.adjustedByUserId ?? null,
    createdAt: now,
  });

  return { ok: true, adjustmentId };
}
