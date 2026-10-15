import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { bookItems, bookPackages, books, packageItems, schools } from "../../../db/schema";
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
  byStatus: { in_stock: number; in_transit: number; disposed: number; lost: number };
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
 * Identitas fisik per barcode tidak dikembalikan; drill-down fisik terpisah.
 */
export async function getLooseStockSummary(
  database: AppDatabase,
  schoolIds: string[]
): Promise<LooseStockSummaryRow[]> {
  if (schoolIds.length === 0) return [];

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

/** Stok paket sebagai satu baris per jenis paket per lokasi, tanpa kode fisik bundel. */
export async function getPackageStockSummary(
  database: AppDatabase,
  schoolIds: string[]
): Promise<PackageStockSummaryRow[]> {
  if (schoolIds.length === 0) return [];

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
