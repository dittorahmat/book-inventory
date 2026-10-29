import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookPackageItems, books, studentBookOrders } from "../../db/schema";
import { WPR_BOOK_ID, WPR_ISBN, WPR_PRICE, WPR_TITLE } from "../../lib/wpr";
import { newWriteId, writeNow, type WriteDeps } from "../lib/d1-write";

/** Pastikan baris buku WPR ada (idempoten, dipakai intake + jalan paket). */
export const ensureWprBook = async (database: AppDatabase, deps?: WriteDeps): Promise<void> => {
  const now = writeNow(deps);
  await database
    .insert(books)
    .values({
      id: WPR_BOOK_ID, isbn: WPR_ISBN, title: WPR_TITLE,
      publicTitle: WPR_TITLE,
      author: "Al Wildan", publisher: "Al Wildan",
      price: WPR_PRICE, buyPrice: 0, sellPrice: WPR_PRICE,
      createdAt: now, updatedAt: now,
    })
    .onConflictDoNothing();
};

/** Pastikan satu paket mengandung WPR di BOM (idempoten). */
export const ensurePackageHasWpr = async (database: AppDatabase, packageId: string, deps?: WriteDeps): Promise<void> => {
  await ensureWprBook(database, deps);
  const existing = await database
    .select({ id: bookPackageItems.id })
    .from(bookPackageItems)
    .where(and(eq(bookPackageItems.packageId, packageId), eq(bookPackageItems.bookId, WPR_BOOK_ID)))
    .limit(1);
  if (existing.length > 0) return;
  await database.insert(bookPackageItems).values({
    id: newWriteId(deps), packageId, bookId: WPR_BOOK_ID, quantity: 1, createdAt: writeNow(deps),
  });
};

/** Jumlah order paket murid (reguler maupun beasiswa/free): >0 berarti bebas WPR. */
export const countPackageOrders = async (database: AppDatabase, studentId: string): Promise<number> => {
  const rows = await database
    .select({ n: sql<number>`count(*)` })
    .from(studentBookOrders)
    .where(and(eq(studentBookOrders.studentId, studentId), isNotNull(studentBookOrders.packageId)));
  return rows[0]?.n ?? 0;
};
