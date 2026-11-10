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
} from "../../../lib/po-demand";
import { readSettingsMap } from "../settings-map";
import { resolveWarehouseId } from "./workflow";

export { calcBufferQty, calcDemandQty };

export const PO_BUFFER_PERCENTAGE_KEY = "po_buffer_percentage";
export const DEFAULT_PO_BUFFER_PERCENTAGE = 10;

export interface BookDemandItem {
  bookId: string;
  studentCount: number;
  warehouseStock: number;
  recommendedOrderQty: number;
}

export interface BookDemandSummary {
  academicYear: string;
  bufferPercentage: number;
  items: Record<string, BookDemandItem>;
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
  const pkgStudentCounts = await database
    .select({
      bookId: bookPackageItems.bookId,
      studentCount: sql<number>`count(distinct ${students.id})`,
    })
    .from(students)
    .innerJoin(
      bookPackages,
      and(
        eq(students.gradeLevel, bookPackages.gradeLevel),
        eq(students.curriculumType, bookPackages.curriculumType),
        eq(students.academicYear, bookPackages.academicYear)
      )
    )
    .innerJoin(bookPackageItems, eq(bookPackages.id, bookPackageItems.packageId))
    .where(and(...pkgConditions))
    .groupBy(bookPackageItems.bookId);

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
    .groupBy(schoolGradeAllowedBooks.bookId);

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
  for (const row of pkgStudentCounts) {
    studentCountMap.set(row.bookId, (studentCountMap.get(row.bookId) ?? 0) + Number(row.studentCount || 0));
  }
  for (const row of allowedStudentCounts) {
    if (!studentCountMap.has(row.bookId)) {
      studentCountMap.set(row.bookId, Number(row.studentCount || 0));
    }
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
    items[bId] = {
      bookId: bId,
      studentCount: sCount,
      warehouseStock: wStock,
      recommendedOrderQty: rec,
    };
  }

  return {
    academicYear: year,
    bufferPercentage,
    items,
  };
}
