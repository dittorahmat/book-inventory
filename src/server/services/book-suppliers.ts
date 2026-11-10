import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookSuppliers, suppliers } from "../../db/schema";
import { chunkRows, runWriteBatch } from "../lib/d1-write";

/** Tulis ulang relasi Book–supplier secara atomik (chunk ≤10, sekuensial di D1). */
export async function replaceBookSuppliers(database: AppDatabase, bookId: string, supplierIds: string[], now: string) {
  const uniq = [...new Set(supplierIds)];
  if (uniq.length > 0) {
    const known: Array<{ id: string }> = await database
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(inArray(suppliers.id, uniq));
    const missing = uniq.filter((id: string) => !known.some((k: { id: string }) => k.id === id));
    if (missing.length > 0) throw new Error(`Supplier tidak ditemukan: ${missing[0]}`);
  }
  await database.delete(bookSuppliers).where(eq(bookSuppliers.bookId, bookId));
  const rows = uniq.map((supplierId) => ({ bookId, supplierId, createdAt: now }));
  for (const chunk of chunkRows(rows)) {
    await runWriteBatch(database, [database.insert(bookSuppliers).values(chunk)]);
  }
}

export const supplierIdsOf = async (database: AppDatabase, bookId: string): Promise<string[]> =>
  (
    (await database
      .select({ supplierId: bookSuppliers.supplierId })
      .from(bookSuppliers)
      .where(eq(bookSuppliers.bookId, bookId))) as Array<{ supplierId: string }>
  ).map((r: { supplierId: string }) => r.supplierId);

export const withSuppliers = async <T extends { id: string }>(database: AppDatabase, book: T): Promise<T & { supplierIds: string[] }> => ({
  ...book,
  supplierIds: await supplierIdsOf(database, book.id),
});
