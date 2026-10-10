import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { books, bookPackageItems, bookPackages } from "../../db/schema";

import { effectiveSellPrice } from "../../lib/book-pricing";
import { writeNow, type WriteDeps } from "../lib/d1-write";

/** Helper DB harga paket — bukan shim presentasi. Fungsi murni diimpor dari lib/book-pricing langsung. */

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
