import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookItems, bookPackageItems, bookPackages, books, packageItems } from "../../db/schema";
import type { StockPotential } from "../../types/stock-summary";
import { AVAILABLE_LOOSE_STATUSES, KITTABLE_CONDITIONS, READY_BUNDLE_STATUSES } from "./stock-buckets";

export type { StockPotential, StockPotentialBreakdown } from "../../types/stock-summary";

export interface PackageBomItem {
  id: string;
  bookId: string;
  title: string;
  isbn: string;
  author: string;
  category: string;
  quantity: number;
}

/** Batas baris daftar paket (§11 anti Pindai Penuh). */
export const PACKAGE_LIST_LIMIT = 50;

/**
 * Satu-satunya pemilik baca daftar paket + BOM: 2 query batch
 * (header + join BOM via inArray) + grouping Map — bukan N+1 per paket.
 */
export async function listPackagesWithBom(
  database: AppDatabase,
  limit: number = PACKAGE_LIST_LIMIT
): Promise<Array<typeof bookPackages.$inferSelect & { items: PackageBomItem[]; totalItemsCount: number }>> {
  const pkgs: Array<typeof bookPackages.$inferSelect> = await database.select().from(bookPackages).limit(limit);
  if (pkgs.length === 0) return [];
  const bom = await database
    .select({
      packageId: bookPackageItems.packageId,
      id: bookPackageItems.id,
      bookId: books.id,
      title: books.title,
      isbn: books.isbn,
      author: books.author,
      category: books.category,
      quantity: bookPackageItems.quantity,
    })
    .from(bookPackageItems)
    .innerJoin(books, eq(bookPackageItems.bookId, books.id))
    .where(inArray(bookPackageItems.packageId, pkgs.map((p: typeof bookPackages.$inferSelect) => p.id)));
  const bomByPkg = new Map<string, PackageBomItem[]>();
  for (const row of bom) {
    const list = bomByPkg.get(row.packageId) ?? [];
    list.push({
      id: row.id,
      bookId: row.bookId,
      title: row.title,
      isbn: row.isbn,
      author: row.author,
      category: row.category,
      quantity: row.quantity,
    });
    bomByPkg.set(row.packageId, list);
  }
  return pkgs.map((pkg: typeof bookPackages.$inferSelect) => {
    const items = bomByPkg.get(pkg.id) ?? [];
    return { ...pkg, items, totalItemsCount: items.reduce((sum, it) => sum + it.quantity, 0) };
  });
}

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
