import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookItems, bookPackageItems, bookPackages, books, packageItems } from "../../db/schema";
import type { StockPotential } from "../../types/stock-summary";
import { AVAILABLE_LOOSE_STATUSES, KITTABLE_CONDITIONS, READY_BUNDLE_STATUSES } from "./stock-buckets";

export type { StockPotential, StockPotentialBreakdown } from "../../types/stock-summary";

/**
 * Satu-satunya pemilik agregasi potensi paket: bundel siap + maksimum
 * rakitan dari stok satuan kondisi baru. Tiga query batch untuk semua
 * paket (bukan N+1 per paket per komponen).
 */
export async function getStockPotentials(
  database: AppDatabase,
  schoolId: string,
  onlyPackageId?: string
): Promise<StockPotential[]> {
  const pkgs: Array<{ id: string }> = onlyPackageId
    ? await database.select({ id: bookPackages.id }).from(bookPackages).where(eq(bookPackages.id, onlyPackageId))
    : await database.select({ id: bookPackages.id }).from(bookPackages);
  if (pkgs.length === 0) return [];

  const bom: Array<{ packageId: string; bookId: string; quantityNeeded: number; title: string; isbn: string }> =
    await database
    .select({
      packageId: bookPackageItems.packageId,
      bookId: bookPackageItems.bookId,
      quantityNeeded: bookPackageItems.quantity,
      title: books.title,
      isbn: books.isbn,
    })
    .from(bookPackageItems)
    .innerJoin(books, eq(bookPackageItems.bookId, books.id));

  const readyRows: Array<{ packageId: string }> = await database
    .select({ packageId: packageItems.packageId })
    .from(packageItems)
    .where(
      and(
        eq(packageItems.currentSchoolId, schoolId),
        inArray(packageItems.status, [...READY_BUNDLE_STATUSES])
      )
    );
  const readyByPkg = new Map<string, number>();
  for (const r of readyRows) readyByPkg.set(r.packageId, (readyByPkg.get(r.packageId) ?? 0) + 1);

  const looseRows: Array<{ bookId: string }> = await database
    .select({ bookId: bookItems.bookId })
    .from(bookItems)
    .where(
      and(
        eq(bookItems.currentSchoolId, schoolId),
        inArray(bookItems.status, [...AVAILABLE_LOOSE_STATUSES]),
        inArray(bookItems.condition, [...KITTABLE_CONDITIONS])
      )
    );
  const looseByBook = new Map<string, number>();
  for (const r of looseRows) looseByBook.set(r.bookId, (looseByBook.get(r.bookId) ?? 0) + 1);

  const bomByPkg = new Map<string, typeof bom>();
  for (const row of bom) {
    const list = bomByPkg.get(row.packageId) ?? [];
    list.push(row);
    bomByPkg.set(row.packageId, list);
  }

  return pkgs.map((pkg) => {
    const components = bomByPkg.get(pkg.id) ?? [];
    let maxPossibleBundles = Infinity;
    const looseStockBreakdown = components.map((item) => {
      const availableCount = looseByBook.get(item.bookId) ?? 0;
      const canMake = Math.floor(availableCount / item.quantityNeeded);
      if (canMake < maxPossibleBundles) maxPossibleBundles = canMake;
      return {
        bookId: item.bookId,
        title: item.title,
        isbn: item.isbn,
        quantityNeeded: item.quantityNeeded,
        availableLooseStock: availableCount,
        maxBundlesFromComponent: canMake,
      };
    });
    return {
      packageId: pkg.id,
      schoolId,
      readyBundleCount: readyByPkg.get(pkg.id) ?? 0,
      maxPossibleBundles: maxPossibleBundles === Infinity ? 0 : maxPossibleBundles,
      looseStockBreakdown,
    };
  });
}
