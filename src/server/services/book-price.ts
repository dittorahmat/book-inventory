import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { books, bookPackageItems, bookPackages } from "../../db/schema";

type PriceLike = { price: number; buyPrice: number; sellPrice: number };

/** Harga jual efektif: fallback ke harga lama (`price`) bila harga jual belum pernah diisi. */
export const effectiveSellPrice = (book: PriceLike): number => (book.sellPrice > 0 ? book.sellPrice : book.price);

/** Harga beli efektif: fallback ke harga lama (`price`) bila harga beli belum pernah diisi. */
export const effectiveBuyPrice = (book: PriceLike): number => (book.buyPrice > 0 ? book.buyPrice : book.price);

/** Hitung ulang total harga paket = SUM(harga jual efektif * kuantitas komponen). */
export async function recalcPackagePrice(packageId: string): Promise<number> {
  const rows = await db
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
  await db
    .update(bookPackages)
    .set({ price: total, updatedAt: new Date().toISOString() })
    .where(eq(bookPackages.id, packageId));
  return total;
}

/** Hitung ulang harga semua paket yang memakai buku tertentu. Mengembalikan jumlah paket yang diperbarui. */
export async function recalcPackagesUsingBook(bookId: string): Promise<number> {
  const rows: Array<{ packageId: string }> = await db
    .select({ packageId: bookPackageItems.packageId })
    .from(bookPackageItems)
    .where(eq(bookPackageItems.bookId, bookId));
  const packageIds = [...new Set(rows.map((r) => r.packageId))];
  await Promise.all(packageIds.map((packageId) => recalcPackagePrice(packageId)));
  return packageIds.length;
}

/** Ambil harga beli/efektif untuk daftar buku (untuk default harga item PO). */
export async function fetchEffectiveBuyPrices(bookIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (bookIds.length === 0) return map;
  const rows = await db
    .select({ id: books.id, price: books.price, buyPrice: books.buyPrice, sellPrice: books.sellPrice })
    .from(books)
    .where(inArray(books.id, bookIds));
  rows.forEach((row: PriceLike & { id: string }) => map.set(row.id, effectiveBuyPrice(row)));
  return map;
}

export interface PoLineInput {
  quantityOrdered: number;
  unitPrice: number;
  discountPercent: number;
}

/** Tiga angka header PO (kotor, diskon, netto). Kanonik server-side agar route + cetak konsisten. */
export const calcPoHeader = (items: PoLineInput[]): { subtotalGross: number; discountTotal: number; totalAmount: number } => {
  const subtotalGross = items.reduce((s, it) => s + (it.quantityOrdered || 0) * (it.unitPrice || 0), 0);
  const discountTotal = items.reduce((s, it) => s + Math.round(((it.quantityOrdered || 0) * (it.unitPrice || 0) * (it.discountPercent || 0)) / 100), 0);
  return { subtotalGross, discountTotal, totalAmount: subtotalGross - discountTotal };
};
