import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  bookItems,
  bookPackageItems,
  bookPackages,
  bookStocks,
  schoolGradeAllowedBooks,
  students,
} from "../../../db/schema";
import { currentAcademicYear } from "../../../lib/wib-time";
import {
  calcBufferQty,
  calcDemandQty,
  resolveInitialOrderQty,
} from "../../../lib/po-demand";
import { readSettingsMap } from "../settings-map";
import { resolveWarehouseId } from "./workflow";
import { books, bookSuppliers } from "../../../db/schema";
import { effectiveBookPrice } from "../../../lib/book-pricing";
import { sqlNormalizeCurriculum } from "../../../lib/curriculum";

export { calcBufferQty, calcDemandQty, resolveInitialOrderQty };
export const computeBookDemand = calculateBookDemandSummary;

export const PO_BUFFER_PERCENTAGE_KEY = "po_buffer_percentage";
export const DEFAULT_PO_BUFFER_PERCENTAGE = 10;

export interface BookDemandItem {
  bookId: string;
  studentCount: number;
  warehouseStock: number;
  recommendedOrderQty: number;
  unitPrice?: number;
  gradeBreakdown?: Record<string, number>;
}

export interface ProposedPOItem {
  bookId: string;
  title: string;
  isbn?: string;
  unitPrice: number;
  quantityOrdered: number;
  studentCount: number;
  warehouseStock: number;
  gradeBreakdown?: Record<string, number>;
}

export interface BookDemandSummary {
  academicYear: string;
  bufferPercentage: number;
  items: Record<string, BookDemandItem>;
  proposedItems?: ProposedPOItem[];
}

/**
 * Membaca konfigurasi default buffer PO dari system_settings (fallback 10%).
 */
export async function getPoBufferSetting(database: AppDatabase): Promise<number> {
  const map = await readSettingsMap(database);
  const raw = map[PO_BUFFER_PERCENTAGE_KEY];
  if (!raw) return DEFAULT_PO_BUFFER_PERCENTAGE;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_PO_BUFFER_PERCENTAGE;
}

/**
 * Menghitung ringkasan kebutuhan buku (demand) berdasarkan siswa aktif tahun ajaran
 * yang terhubung via BOM paket buku (`book_packages` & `book_package_items`) serta
 * buku suplemen satuan terdaftar (`school_grade_allowed_books`).
 */
export async function calculateBookDemandSummary(
  database: AppDatabase,
  options?: {
    academicYear?: string;
    bufferPercentage?: number;
    bookIds?: string[];
    supplierId?: string;
  }
): Promise<BookDemandSummary> {
  const year = options?.academicYear?.trim() || currentAcademicYear();
  const configuredBuffer = await getPoBufferSetting(database);
  const bufferPercentage =
    options?.bufferPercentage !== undefined && Number.isFinite(options.bufferPercentage) && options.bufferPercentage >= 0
      ? options.bufferPercentage
      : configuredBuffer;

  const warehouseId = await resolveWarehouseId(database);

  // Filter bookIds di tingkat query SQL bila spesifik diminta (§10 D1 search discipline)
  const pkgConditions = [
    eq(students.academicYear, year),
    inArray(students.status, ["active", "promoted", "new_pending"]),
  ];
  if (options?.bookIds && options.bookIds.length > 0) {
    pkgConditions.push(inArray(bookPackageItems.bookId, options.bookIds));
  }

  // 1. Hitung siswa aktif per buku via BOM paket buku
  // Mendukung normalisasi kurikulum via sqlNormalizeCurriculum (§0.59)
  const pkgStudentCounts = await database
    .select({
      bookId: bookPackageItems.bookId,
      gradeLevel: students.gradeLevel,
      studentCount: sql<number>`count(distinct ${students.id})`,
    })
    .from(students)
    .innerJoin(
      bookPackages,
      and(
        eq(students.gradeLevel, bookPackages.gradeLevel),
        sql`${sqlNormalizeCurriculum(sql`${students.curriculumType}`)} = ${sqlNormalizeCurriculum(sql`${bookPackages.curriculumType}`)}`,
        eq(students.academicYear, bookPackages.academicYear)
      )
    )
    .innerJoin(bookPackageItems, eq(bookPackages.id, bookPackageItems.packageId))
    .where(and(...pkgConditions))
    .groupBy(bookPackageItems.bookId, students.gradeLevel);

  // 2. Hitung siswa aktif via school_grade_allowed_books (jika ada suplemen)
  const allowedConditions = [
    eq(students.academicYear, year),
    inArray(students.status, ["active", "promoted", "new_pending"]),
  ];
  if (options?.bookIds && options.bookIds.length > 0) {
    allowedConditions.push(inArray(schoolGradeAllowedBooks.bookId, options.bookIds));
  }

  const allowedStudentCounts = await database
    .select({
      bookId: schoolGradeAllowedBooks.bookId,
      gradeLevel: students.gradeLevel,
      studentCount: sql<number>`count(distinct ${students.id})`,
    })
    .from(students)
    .innerJoin(
      schoolGradeAllowedBooks,
      and(
        eq(students.schoolId, schoolGradeAllowedBooks.schoolId),
        eq(students.gradeLevel, schoolGradeAllowedBooks.gradeLevel)
      )
    )
    .where(and(...allowedConditions))
    .groupBy(schoolGradeAllowedBooks.bookId, students.gradeLevel);

  // 3. Hitung stok fisik lepas di Gudang Logistik dari book_stocks (agregat)
  const aggrConditions = [];
  if (warehouseId) {
    aggrConditions.push(eq(bookStocks.schoolId, warehouseId));
  }
  if (options?.bookIds && options.bookIds.length > 0) {
    aggrConditions.push(inArray(bookStocks.bookId, options.bookIds));
  }

  const aggrStockCounts = await database
    .select({
      bookId: bookStocks.bookId,
      availableQuantity: bookStocks.availableQuantity,
    })
    .from(bookStocks)
    .where(aggrConditions.length > 0 ? and(...aggrConditions) : undefined);

  // Ambil juga fallback dari book_items jika ada data historis/test
  const stockConditions = [
    eq(bookItems.status, "in_stock"),
    eq(bookItems.isRejected, false),
  ];
  if (warehouseId) {
    stockConditions.push(eq(bookItems.currentSchoolId, warehouseId));
  }
  if (options?.bookIds && options.bookIds.length > 0) {
    stockConditions.push(inArray(bookItems.bookId, options.bookIds));
  }

  const stockCounts = await database
    .select({
      bookId: bookItems.bookId,
      stockCount: sql<number>`count(${bookItems.id})`,
    })
    .from(bookItems)
    .where(and(...stockConditions))
    .groupBy(bookItems.bookId);

  const studentCountMap = new Map<string, number>();
  const gradeBreakdownMap = new Map<string, Record<string, number>>();

  for (const row of pkgStudentCounts) {
    const bId = row.bookId;
    const gLevel = row.gradeLevel || "Lainnya";
    const count = Number(row.studentCount || 0);
    studentCountMap.set(bId, (studentCountMap.get(bId) ?? 0) + count);
    if (!gradeBreakdownMap.has(bId)) gradeBreakdownMap.set(bId, {});
    const bd = gradeBreakdownMap.get(bId)!;
    bd[gLevel] = (bd[gLevel] ?? 0) + count;
  }
  for (const row of allowedStudentCounts) {
    const bId = row.bookId;
    const gLevel = row.gradeLevel || "Lainnya";
    const count = Number(row.studentCount || 0);
    studentCountMap.set(bId, (studentCountMap.get(bId) ?? 0) + count);
    if (!gradeBreakdownMap.has(bId)) gradeBreakdownMap.set(bId, {});
    const bd = gradeBreakdownMap.get(bId)!;
    bd[gLevel] = (bd[gLevel] ?? 0) + count;
  }

  const stockMap = new Map<string, number>();
  for (const row of aggrStockCounts) {
    stockMap.set(row.bookId, row.availableQuantity ?? 0);
  }
  // Fallback untuk buku yang belum memiliki saldo di book_stocks
  for (const row of stockCounts) {
    if (!stockMap.has(row.bookId)) {
      stockMap.set(row.bookId, Number(row.stockCount || 0));
    }
  }

  // Kumpulkan list buku target
  const items: Record<string, BookDemandItem> = {};
  const targetIds = options?.bookIds && options.bookIds.length > 0
    ? options.bookIds
    : Array.from(new Set<string>([...studentCountMap.keys(), ...stockMap.keys()]));

  for (const bId of targetIds) {
    const sCount = studentCountMap.get(bId) ?? 0;
    const wStock = stockMap.get(bId) ?? 0;
    const rec = calcDemandQty(sCount, bufferPercentage, wStock);
    const gradeBreakdown = gradeBreakdownMap.get(bId);
    items[bId] = {
      bookId: bId,
      studentCount: sCount,
      warehouseStock: wStock,
      recommendedOrderQty: rec,
      ...(gradeBreakdown && Object.keys(gradeBreakdown).length > 0 ? { gradeBreakdown } : {}),
    };
  }

  let proposedItems: ProposedPOItem[] | undefined;
  if (options?.supplierId) {
    const eligible = await database
      .select({
        id: books.id,
        title: books.title,
        isbn: books.isbn,
        buyPrice: books.buyPrice,
        price: books.price,
      })
      .from(books)
      .innerJoin(bookSuppliers, eq(books.id, bookSuppliers.bookId))
      .where(eq(bookSuppliers.supplierId, options.supplierId));

    proposedItems = eligible.map((b) => {
      const demand = items[b.id];
      const sCount = demand?.studentCount ?? 0;
      const wStock = demand?.warehouseStock ?? 0;
      const initialQty = resolveInitialOrderQty(sCount, bufferPercentage, wStock);
      const buyPrice = effectiveBookPrice(b).buy;
      return {
        bookId: b.id,
        title: b.title,
        isbn: b.isbn ?? undefined,
        unitPrice: buyPrice,
        quantityOrdered: initialQty,
        studentCount: sCount,
        warehouseStock: wStock,
        gradeBreakdown: demand?.gradeBreakdown,
      };
    });
  }

  return {
    academicYear: year,
    bufferPercentage,
    items,
    proposedItems,
  };
}
