import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { bookPackageItems, bookPackages } from "../../db/schema";
import { chunkRows, runWriteBatch, selectInChunks } from "../lib/d1-write";
import { recalcPackagePrice } from "./pricing";

export interface BookPackageRef {
  packageId: string;
  code: string;
  name: string;
  gradeLevel: string;
  curriculumType: string;
}

/** Mengambil daftar paket tempat buku ini terdaftar sebagai komponen. */
export async function getPackagesForBook(database: AppDatabase, bookId: string): Promise<BookPackageRef[]> {
  const rows = await database
    .select({
      packageId: bookPackages.id,
      code: bookPackages.code,
      name: bookPackages.name,
      gradeLevel: bookPackages.gradeLevel,
      curriculumType: bookPackages.curriculumType,
    })
    .from(bookPackageItems)
    .innerJoin(bookPackages, eq(bookPackageItems.packageId, bookPackages.id))
    .where(eq(bookPackageItems.bookId, bookId));

  return rows;
}

/** Mengambil map paket untuk banyak buku sekaligus (menggunakan chunking agar hemat D1 params). */
export async function getPackagesForBooksMap(database: AppDatabase, bookIds: string[]): Promise<Map<string, BookPackageRef[]>> {
  const result = new Map<string, BookPackageRef[]>();
  if (bookIds.length === 0) return result;

  const links = await selectInChunks(bookIds, (idChunk) =>
    database
      .select({
        bookId: bookPackageItems.bookId,
        packageId: bookPackages.id,
        code: bookPackages.code,
        name: bookPackages.name,
        gradeLevel: bookPackages.gradeLevel,
        curriculumType: bookPackages.curriculumType,
      })
      .from(bookPackageItems)
      .innerJoin(bookPackages, eq(bookPackageItems.packageId, bookPackages.id))
      .where(inArray(bookPackageItems.bookId, idChunk))
  );

  for (const l of links) {
    const list = result.get(l.bookId) ?? [];
    list.push({
      packageId: l.packageId,
      code: l.code,
      name: l.name,
      gradeLevel: l.gradeLevel,
      curriculumType: l.curriculumType,
    });
    result.set(l.bookId, list);
  }

  return result;
}

/** Mengganti daftar paket yang memuat buku ini secara atomik, lalu memicu rekalkulasi harga paket. */
export async function replaceBookPackages(
  database: AppDatabase,
  bookId: string,
  targetPackageIds: string[],
  now: string
): Promise<number> {
  const uniqTarget = [...new Set(targetPackageIds)];

  if (uniqTarget.length > 0) {
    const known = await database
      .select({ id: bookPackages.id })
      .from(bookPackages)
      .where(inArray(bookPackages.id, uniqTarget));
    const knownSet = new Set(known.map((k) => k.id));
    const missing = uniqTarget.filter((id) => !knownSet.has(id));
    if (missing.length > 0) {
      throw new Error(`Paket buku tidak ditemukan: ${missing[0]}`);
    }
  }

  // Cari paket yang sebelumnya memuat buku ini agar harganya juga dihitung ulang
  const previousRows = await database
    .select({ packageId: bookPackageItems.packageId })
    .from(bookPackageItems)
    .where(eq(bookPackageItems.bookId, bookId));
  const previousPackageIds = previousRows.map((r) => r.packageId);

  // Hapus semua relasi buku ini dari bookPackageItems
  await database.delete(bookPackageItems).where(eq(bookPackageItems.bookId, bookId));

  // Masukkan relasi baru
  const rowsToInsert = uniqTarget.map((packageId) => ({
    id: crypto.randomUUID(),
    packageId,
    bookId,
    quantity: 1,
    createdAt: now,
  }));

  for (const chunk of chunkRows(rowsToInsert)) {
    await runWriteBatch(database, [database.insert(bookPackageItems).values(chunk)]);
  }

  // Hitung ulang harga paket yang terkena dampak perubahan (gabungan paket lama & baru)
  const affectedPackageIds = [...new Set([...previousPackageIds, ...uniqTarget])];
  for (const pid of affectedPackageIds) {
    await recalcPackagePrice(database, pid);
  }

  return affectedPackageIds.length;
}
