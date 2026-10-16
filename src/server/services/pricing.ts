import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookPackageItems, bookPackages, books } from "../../db/schema";
import { effectiveSellPrice } from "../../lib/book-pricing";
import { WPR_BOOK_ID, needsWprCharge } from "../../lib/wpr";
import { countPackageOrders } from "./wpr";
import { writeNow, type WriteDeps } from "../lib/d1-write";

/**
 * Satu-satunya seam harga + WPR di server: harga efektif murni tetap
 * tinggal di `lib/book-pricing` (aman untuk bundle klien), komposisi
 * ber-DB dan pengecualian rakitan tinggal di balik seam ini.
 */

/** BOM siap rakit: WPR bukan stok fisik rakitan (tetap di BOM untuk harga). */
export function kitBomWithoutWpr<T extends { bookId: string }>(bom: T[]): T[] {
  return bom.filter((b) => b.bookId !== WPR_BOOK_ID);
}

/** True bila murid wajib menanggung WPR: belum ada order paket. */
export const needsWprForStudent = async (database: AppDatabase, studentId: string): Promise<boolean> =>
  needsWprCharge(await countPackageOrders(database, studentId));

/** Hitung ulang total harga paket = SUM(harga jual efektif * kuantitas komponen). */
export async function recalcPackagePrice(database: AppDatabase, packageId: string, deps?: WriteDeps): Promise<number> {
  const rows = await database
    .select({
      quantity: bookPackageItems.quantity,
      price: books.price,
      buyPrice: books.buyPrice,
      sellPrice: books.sellPrice,
    })
    .from(bookPackageItems)
    .innerJoin(books, eq(bookPackageItems.bookId, books.id))
    .where(eq(bookPackageItems.packageId, packageId));

  const total = rows.reduce((sum: number, r: { quantity: number; price: number; buyPrice: number; sellPrice: number }) => sum + r.quantity * effectiveSellPrice(r), 0);
  await database
    .update(bookPackages)
    .set({ price: total, updatedAt: writeNow(deps) })
    .where(eq(bookPackages.id, packageId));
  return total;
}

/** Hitung ulang harga semua paket yang memakai buku tertentu. Mengembalikan jumlah paket yang diperbarui. */
export async function recalcPackagesUsingBook(database: AppDatabase, bookId: string, deps?: WriteDeps): Promise<number> {
  const rows: Array<{ packageId: string }> = await database
    .select({ packageId: bookPackageItems.packageId })
    .from(bookPackageItems)
    .where(eq(bookPackageItems.bookId, bookId));
  const packageIds = [...new Set(rows.map((r) => r.packageId))];
  // Sekuensial: tulis konkuren via Promise.all dilarang untuk D1 (§10).
  for (const packageId of packageIds) await recalcPackagePrice(database, packageId, deps);
  return packageIds.length;
}
