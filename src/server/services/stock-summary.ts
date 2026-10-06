import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { bookItems, bookPackages, books, packageItems, schools } from "../../db/schema";

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

const emptyCondition = () => ({ new: 0, good: 0, fair: 0, damaged: 0 });
const emptyBookStatus = () => ({ in_stock: 0, in_transit: 0, disposed: 0, lost: 0 });
const emptyPackageStatus = () => ({ in_stock: 0, reserved: 0, dispatched: 0, delivered: 0 });

const getOrInit = <K, V>(m: Map<K, V>, k: K, mk: () => V): V => m.get(k) ?? (m.set(k, mk()).get(k) as V);

/**
 * Stok satuan sebagai satu baris per judul per lokasi (spec: inventory-summary).
 * Identitas fisik per barcode tidak dikembalikan; drill-down fisik terpisah.
 */
export async function getLooseStockSummary(
  schoolIds: string[]
): Promise<LooseStockSummaryRow[]> {
  if (schoolIds.length === 0) return [];

  const rows = await db
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

  const grouped = new Map<string, LooseStockSummaryRow>();
  for (const row of rows) {
    const entry = getOrInit(grouped, `${row.schoolId}|${row.bookId}`, () => ({
        schoolId: row.schoolId,
        schoolName: row.schoolName,
        bookId: row.bookId,
        title: row.title,
        isbn: row.isbn,
        coverUrl: row.coverUrl,
        sellPrice: row.sellPrice > 0 ? row.sellPrice : row.price,
        totalQty: 0,
        availableQty: 0,
        inTransitQty: 0,
        byCondition: emptyCondition(),
        byStatus: emptyBookStatus(),
      }));
    entry.totalQty += 1;
    entry.byCondition[row.condition as keyof typeof entry.byCondition] += 1;
    entry.byStatus[row.status as keyof typeof entry.byStatus] += 1;
    if (row.status === "in_stock") entry.availableQty += 1;
    if (row.status === "in_transit") entry.inTransitQty += 1;
  }

  return [...grouped.values()].sort(
    (a, b) => a.schoolId.localeCompare(b.schoolId) || a.title.localeCompare(b.title)
  );
}

/** Stok paket sebagai satu baris per jenis paket per lokasi, tanpa kode fisik bundel. */
export async function getPackageStockSummary(
  schoolIds: string[]
): Promise<PackageStockSummaryRow[]> {
  if (schoolIds.length === 0) return [];

  const rows = await db
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

  const grouped = new Map<string, PackageStockSummaryRow>();
  for (const row of rows) {
    const entry = getOrInit(grouped, `${row.schoolId}|${row.packageId}`, () => ({
        schoolId: row.schoolId,
        schoolName: row.schoolName,
        packageId: row.packageId,
        code: row.code,
        name: row.name,
        gradeLevel: row.gradeLevel,
        curriculumType: row.curriculumType,
        price: row.price,
        totalQty: 0,
        readyQty: 0,
        byStatus: emptyPackageStatus(),
      }));
    entry.totalQty += 1;
    entry.byStatus[row.status as keyof typeof entry.byStatus] += 1;
    if (row.status === "in_stock") entry.readyQty += 1;
  }

  return [...grouped.values()].sort(
    (a, b) => a.schoolId.localeCompare(b.schoolId) || a.name.localeCompare(b.name)
  );
}
