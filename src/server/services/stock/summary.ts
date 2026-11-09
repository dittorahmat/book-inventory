import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { bookItems, bookPackages, books, bookStocks, packageItems, packageStocks, schools } from "../../../db/schema";
import { effectiveSellPrice } from "../../../lib/book-pricing";
import { tallyLooseByKey, tallyPackagesByKey } from "./kernel";

export interface LooseStockSummaryRow {
  schoolId: string;
  schoolName: string;
  bookId: string;
  title: string;
  isbn: string;
  coverUrl: string | null;
  sellPrice: number;
  totalQty: number;
  availableQty: number;
  inTransitQty: number;
  byCondition: { new: number; good: number; fair: number; damaged: number };
  byStatus: { in_stock: number; in_transit: number; disposed: number; lost: number; sold: number };
}

export interface PackageStockSummaryRow {
  schoolId: string;
  schoolName: string;
  packageId: string;
  code: string;
  name: string;
  gradeLevel: string;
  curriculumType: string;
  price: number;
  totalQty: number;
  readyQty: number;
  byStatus: { in_stock: number; reserved: number; dispatched: number; delivered: number };
}

/**
 * Stok satuan sebagai satu baris per judul per lokasi (spec: inventory-summary).
 * Mengutamakan pembacaan dari tabel kuantitas agregat `book_stocks`.
 * Bila kosong (data pengujian lama), fallback ke unit eksemplar fisik `book_items`.
 */
export async function getLooseStockSummary(
  database: AppDatabase,
  schoolIds: string[]
): Promise<LooseStockSummaryRow[]> {
  if (schoolIds.length === 0) return [];

  // 1. Coba baca dari tabel agregat book_stocks
  const aggrRows = await database
    .select({
      schoolId: bookStocks.schoolId,
      schoolName: schools.name,
      bookId: bookStocks.bookId,
      title: books.title,
      isbn: books.isbn,
      coverUrl: books.coverUrl,
      price: books.price,
      sellPrice: books.sellPrice,
      availableQuantity: bookStocks.availableQuantity,
      reservedQuantity: bookStocks.reservedQuantity,
    })
    .from(bookStocks)
    .innerJoin(books, eq(bookStocks.bookId, books.id))
    .innerJoin(schools, eq(bookStocks.schoolId, schools.id))
    .where(inArray(bookStocks.schoolId, schoolIds));

  if (aggrRows.length > 0) {
    return aggrRows
      .map((row) => {
        const avail = row.availableQuantity ?? 0;
        const res = row.reservedQuantity ?? 0;
        const total = avail + res;
        return {
          schoolId: row.schoolId,
          schoolName: row.schoolName,
          bookId: row.bookId,
          title: row.title,
          isbn: row.isbn,
          coverUrl: row.coverUrl,
          sellPrice: effectiveSellPrice(row),
          totalQty: total,
          availableQty: avail,
          inTransitQty: 0,
          byCondition: { new: avail, good: res, fair: 0, damaged: 0 },
          byStatus: { in_stock: avail, in_transit: 0, disposed: 0, lost: 0, sold: 0 },
        };
      })
      .sort((a, b) => a.schoolId.localeCompare(b.schoolId) || a.title.localeCompare(b.title));
  }

  // 2. Fallback ke tabel fisik historis book_items jika book_stocks kosong
  const rows = await database
    .select({
      schoolId: bookItems.currentSchoolId,
      schoolName: schools.name,
      bookId: bookItems.bookId,
      title: books.title,
      isbn: books.isbn,
      coverUrl: books.coverUrl,
      price: books.price,
      sellPrice: books.sellPrice,
      condition: bookItems.condition,
      status: bookItems.status,
    })
    .from(bookItems)
    .innerJoin(books, eq(bookItems.bookId, books.id))
    .innerJoin(schools, eq(bookItems.currentSchoolId, schools.id))
    .where(inArray(bookItems.currentSchoolId, schoolIds));

  type Row = (typeof rows)[number];
  const metas = new Map<string, Omit<LooseStockSummaryRow, "totalQty" | "availableQty" | "inTransitQty" | "byCondition" | "byStatus">>();
  for (const row of rows as Row[]) {
    const key = `${row.schoolId}|${row.bookId}`;
    if (!metas.has(key)) {
      metas.set(key, {
        schoolId: row.schoolId,
        schoolName: row.schoolName,
        bookId: row.bookId,
        title: row.title,
        isbn: row.isbn,
        coverUrl: row.coverUrl,
        sellPrice: effectiveSellPrice(row),
      });
    }
  }
  const tallies = tallyLooseByKey(rows as Row[], (row) => `${row.schoolId}|${row.bookId}`);

  return [...tallies.entries()]
    .map(([key, tally]) => {
      const meta = metas.get(key)!;
      return {
        ...meta,
        totalQty: tally.totalQty,
        availableQty: tally.availableQty,
        inTransitQty: tally.inTransitQty,
        byCondition: tally.byConditionAll,
        byStatus: tally.byStatus,
      };
    })
    .sort(
    (a, b) => a.schoolId.localeCompare(b.schoolId) || a.title.localeCompare(b.title)
  );
}

/**
 * Stok paket sebagai satu baris per jenis paket per lokasi, tanpa kode fisik bundel.
 * Mengutamakan pembacaan dari tabel agregat `package_stocks`.
 * Bila kosong (data pengujian lama), fallback ke unit eksemplar fisik `package_items`.
 */
export async function getPackageStockSummary(
  database: AppDatabase,
  schoolIds: string[]
): Promise<PackageStockSummaryRow[]> {
  if (schoolIds.length === 0) return [];

  // 1. Coba baca dari tabel agregat package_stocks
  const aggrRows = await database
    .select({
      schoolId: packageStocks.schoolId,
      schoolName: schools.name,
      packageId: packageStocks.packageId,
      code: bookPackages.code,
      name: bookPackages.name,
      gradeLevel: bookPackages.gradeLevel,
      curriculumType: bookPackages.curriculumType,
      price: bookPackages.price,
      availableQuantity: packageStocks.availableQuantity,
      reservedQuantity: packageStocks.reservedQuantity,
    })
    .from(packageStocks)
    .innerJoin(bookPackages, eq(packageStocks.packageId, bookPackages.id))
    .innerJoin(schools, eq(packageStocks.schoolId, schools.id))
    .where(inArray(packageStocks.schoolId, schoolIds));

  if (aggrRows.length > 0) {
    return aggrRows
      .map((row) => {
        const ready = row.availableQuantity ?? 0;
        const res = row.reservedQuantity ?? 0;
        const total = ready + res;
        return {
          schoolId: row.schoolId,
          schoolName: row.schoolName,
          packageId: row.packageId,
          code: row.code,
          name: row.name,
          gradeLevel: row.gradeLevel,
          curriculumType: row.curriculumType,
          price: row.price,
          totalQty: total,
          readyQty: ready,
          byStatus: { in_stock: ready, reserved: res, dispatched: 0, delivered: 0 },
        };
      })
      .sort((a, b) => a.schoolId.localeCompare(b.schoolId) || a.name.localeCompare(b.name));
  }

  // 2. Fallback ke tabel fisik historis package_items jika package_stocks kosong
  const rows = await database
    .select({
      schoolId: packageItems.currentSchoolId,
      schoolName: schools.name,
      packageId: packageItems.packageId,
      code: bookPackages.code,
      name: bookPackages.name,
      gradeLevel: bookPackages.gradeLevel,
      curriculumType: bookPackages.curriculumType,
      price: bookPackages.price,
      status: packageItems.status,
    })
    .from(packageItems)
    .innerJoin(bookPackages, eq(packageItems.packageId, bookPackages.id))
    .innerJoin(schools, eq(packageItems.currentSchoolId, schools.id))
    .where(inArray(packageItems.currentSchoolId, schoolIds));

  type Row = (typeof rows)[number];
  const grouped = tallyPackagesByKey(rows as Row[], (row) => `${row.schoolId}|${row.packageId}`);
  const metas = new Map<string, Omit<PackageStockSummaryRow, "totalQty" | "readyQty" | "byStatus">>();
  for (const row of rows as Row[]) {
    const key = `${row.schoolId}|${row.packageId}`;
    if (!metas.has(key)) {
      metas.set(key, {
        schoolId: row.schoolId,
        schoolName: row.schoolName,
        packageId: row.packageId,
        code: row.code,
        name: row.name,
        gradeLevel: row.gradeLevel,
        curriculumType: row.curriculumType,
        price: row.price,
      });
    }
  }

  return [...grouped.entries()]
    .map(([key, tally]) => ({ ...metas.get(key)!, totalQty: tally.totalQty, readyQty: tally.readyQty, byStatus: tally.byStatus }))
    .sort(
    (a, b) => a.schoolId.localeCompare(b.schoolId) || a.name.localeCompare(b.name)
  );
}
