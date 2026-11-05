import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  books,
  bookPackages,
  bookPackageItems,
  bookPackageSchools,
  schoolGradeAllowedBooks,
  systemSettings,
} from "../../../db/schema";
import { currentAcademicYear, isWIBOnOrAfter, todayWIB } from "../../../lib/wib-time";
import { effectiveSellPrice } from "../../../lib/book-pricing";
import type { SatuanOverride, SatuanStatus } from "../../../lib/portal-types";

export type { SatuanOverride, SatuanStatus } from "../../../lib/portal-types";

/** Kunci pengaturan cut-off order satuan (design D7). */
export const openFromKey = (academicYear: string) => `satuan_open_from:${academicYear}`;
export const overrideKey = (academicYear: string) => `satuan_override:${academicYear}`;

const readSetting = (database: AppDatabase, key: string): Promise<string | null> =>
  database
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .then((rows: Array<{ value: string }>) => rows[0]?.value ?? null);

const writeSetting = async (database: AppDatabase, key: string, value: string, description: string) => {
  const now = new Date().toISOString();
  await database
    .insert(systemSettings)
    .values({ key, value, description, updatedAt: now })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value, description, updatedAt: now } });
};

/**
 * Status openness order satuan untuk satu tahun ajaran.
 * Urutan evaluasi: override manual → tanggal efektif WIB → default tertutup.
 */
export async function getSatuanStatus(
  database: AppDatabase,
  academicYear: string,
  now: Date = new Date()
): Promise<SatuanStatus> {
  const today = todayWIB(now);
  const openFrom = await readSetting(database, openFromKey(academicYear));
  const rawOverride = await readSetting(database, overrideKey(academicYear));
  const override: SatuanOverride | null =
    rawOverride === "open" || rawOverride === "closed" ? rawOverride : null;

  const open = override === "open" || (!override && !!openFrom && isWIBOnOrAfter(today, openFrom));
  const reason =
    override === "open"
      ? "Order satuan dipaksa buka oleh admin."
      : override === "closed"
        ? "Order satuan dipaksa tutup oleh admin."
        : !openFrom
          ? "Order satuan belum dibuka untuk tahun ajaran ini."
          : today < openFrom
            ? `Order satuan dibuka mulai ${openFrom}.`
            : `Order satuan terbuka sejak ${openFrom}.`;
  return { academicYear, open, todayWIB: today, openFrom: openFrom ?? null, override, reason };
}

/** Simpan tanggal efektif pembuka order satuan (format YYYY-MM-DD). */
export async function setSatuanOpenFrom(
  database: AppDatabase,
  academicYear: string,
  dateIso: string
): Promise<SatuanStatus> {
  await writeSetting(
    database,
    openFromKey(academicYear),
    dateIso,
    `Tanggal buka order satuan tahun ajaran ${academicYear}`
  );
  return getSatuanStatus(database, academicYear);
}

/** Simpan override manual; null berarti kembali ke aturan tanggal. */
export async function setSatuanOverride(
  database: AppDatabase,
  academicYear: string,
  override: SatuanOverride | null
): Promise<SatuanStatus> {
  const key = overrideKey(academicYear);
  if (override === null) {
    await database.delete(systemSettings).where(eq(systemSettings.key, key));
  } else {
    await writeSetting(
      database,
      key,
      override,
      `Override manual order satuan tahun ajaran ${academicYear}`
    );
  }
  return getSatuanStatus(database, academicYear);
}

/** Status untuk tahun ajaran berjalan, dipakai form publik tanpa parameter tahun. */
export function getCurrentSatuanStatus(database: AppDatabase, now: Date = new Date()): Promise<SatuanStatus> {
  return getSatuanStatus(database, currentAcademicYear(now), now);
}

export interface SatuanCatalogBook {
  id: string;
  title: string;
  sellPrice: number;
}

export interface SatuanCatalog {
  open: boolean;
  status: SatuanStatus;
  books: SatuanCatalogBook[];
}

export interface SatuanCatalogQuery {
  academicYear?: string;
  schoolId?: string;
  gradeLevel?: string;
}

/**
 * Kemampuan cut-off + katalog dalam satu panggilan: status dievaluasi sekali,
 * lalu buku di-query hanya saat terbuka — katalog basi setelah cut-off flip
 * tidak mungkin terjadi.
 * Jika context schoolId & gradeLevel disertakan, pilihan dibatasi secara ketat
 * hanya pada buku dalam BOM paket murid + whitelist override admin.
 */
export async function getSatuanCatalogIfOpen(
  database: AppDatabase,
  queryOrYear?: string | SatuanCatalogQuery
): Promise<SatuanCatalog> {
  const query: SatuanCatalogQuery =
    typeof queryOrYear === "string" ? { academicYear: queryOrYear } : (queryOrYear ?? {});
  const year = query.academicYear?.trim() || currentAcademicYear(new Date());
  const status = await getSatuanStatus(database, year);
  if (!status.open) {
    return { open: false, status, books: [] };
  }

  let allowedBookIds: string[] | null = null;

  if (query.schoolId && query.gradeLevel) {
    // 1. Ambil paket-paket yang cocok dengan jenjang & tahun ajaran murid
    const matchingPackages = await database
      .select({ id: bookPackages.id })
      .from(bookPackages)
      .where(and(eq(bookPackages.gradeLevel, query.gradeLevel), eq(bookPackages.academicYear, year)));

    const pkgIds = matchingPackages.map((p) => p.id);
    let validPkgIds: string[] = [];

    if (pkgIds.length > 0) {
      // Periksa assignment sekolah (paket universal vs spesifik cabang)
      const assignments = await database
        .select({
          packageId: bookPackageSchools.packageId,
          schoolId: bookPackageSchools.schoolId,
        })
        .from(bookPackageSchools)
        .where(inArray(bookPackageSchools.packageId, pkgIds));

      const assignedPkgMap = new Map<string, string[]>();
      for (const a of assignments) {
        const list = assignedPkgMap.get(a.packageId) ?? [];
        list.push(a.schoolId);
        assignedPkgMap.set(a.packageId, list);
      }

      validPkgIds = pkgIds.filter((id) => {
        const schoolsList = assignedPkgMap.get(id);
        // Universal (tanpa baris sekolah) ATAU ditugaskan ke sekolah murid ini
        return !schoolsList || schoolsList.length === 0 || schoolsList.includes(query.schoolId!);
      });
    }

    const bomBookIds: string[] = [];
    if (validPkgIds.length > 0) {
      const bomItems = await database
        .select({ bookId: bookPackageItems.bookId })
        .from(bookPackageItems)
        .where(inArray(bookPackageItems.packageId, validPkgIds));
      bomBookIds.push(...bomItems.map((b) => b.bookId));
    }

    // 2. Ambil whitelist override admin untuk sekolah & jenjang ini
    const overrideItems = await database
      .select({ bookId: schoolGradeAllowedBooks.bookId })
      .from(schoolGradeAllowedBooks)
      .where(
        and(
          eq(schoolGradeAllowedBooks.schoolId, query.schoolId),
          eq(schoolGradeAllowedBooks.gradeLevel, query.gradeLevel)
        )
      );

    allowedBookIds = [...new Set([...bomBookIds, ...overrideItems.map((o) => o.bookId)])];
  }

  // Jika allowedBookIds ada tapi kosong (misal belum ada paket yang di-assign), return empty
  if (allowedBookIds !== null && allowedBookIds.length === 0) {
    return { open: true, status, books: [] };
  }

  const baseQuery = database
    .select({
      id: books.id,
      title: books.title,
      publicTitle: books.publicTitle,
      price: books.price,
      sellPrice: books.sellPrice,
    })
    .from(books);

  const rows = allowedBookIds
    ? await baseQuery.where(inArray(books.id, allowedBookIds)).orderBy(books.title)
    : await baseQuery.orderBy(books.title);

  // Anti window-shopping: alias samaran saja (fallback generik), tanpa
  // ISBN/penulis/penerbit/cover.
  return {
    open: true,
    status,
    books: rows.map((b: { id: string; title: string; publicTitle: string | null; price: number; sellPrice: number }) => ({
      id: b.id,
      title: b.publicTitle ?? "Buku Paket",
      sellPrice: effectiveSellPrice(b),
    })),
  };
}
