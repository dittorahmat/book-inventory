import { eq, inArray } from "drizzle-orm";
import { bookPackageItems, bookPackages, books } from "../../db/schema";
import { resolveBookIsbn } from "../../lib/isbn";
import { chunkRows } from "../lib/d1-write";
import type { AppDatabase } from "../../db";

export interface BookImportRow {
  id?: string;
  title: string;
  author?: string;
  publisher?: string;
  publishYear?: number;
  category?: string;
  description?: string;
  price?: number;
  buyPrice?: number;
  sellPrice?: number;
  isbn?: string;
  gradeLevel?: string;
  curriculumType?: "international" | "national";
  academicYear?: string;
}

export interface BookImportOptions {
  autoCreatePackages?: boolean;
  academicYear?: string;
}

export interface BookImportResult {
  insertedCount: number;
  updatedCount: number;
  packagesCreatedCount: number;
  total: number;
}

/**
 * Service seam untuk import masal katalog buku yang aman D1 batching,
 * dengan dukungan otomatis membentuk master paket buku (BOM) per tingkat & kurikulum.
 */
export async function importBookCatalog(
  database: AppDatabase,
  items: BookImportRow[],
  options?: BookImportOptions
): Promise<BookImportResult> {
  let insertedCount = 0;
  let updatedCount = 0;
  let packagesCreatedCount = 0;
  const nowIso = new Date().toISOString();
  const academicYear = options?.academicYear || "2026/2027";

  // 1. Ekstrak ISBN dan cari buku yang sudah ada dengan batch chunking D1
  const normalizedItems = items.map((item) => ({
    ...item,
    resolvedIsbn: resolveBookIsbn(item.isbn, undefined, undefined, item.title, item.gradeLevel),
    effectivePrice: Math.round(item.sellPrice ?? item.price ?? 0),
    effectiveBuyPrice: Math.round(item.buyPrice ?? item.price ?? 0),
    gradeLevel: item.gradeLevel || "1",
    curriculumType: item.curriculumType || "international",
  }));


  const allIsbns = normalizedItems.map((i) => i.resolvedIsbn);
  const existingMap = new Map<string, string>(); // isbn -> id

  const isbnChunks = chunkRows(allIsbns, 10);
  for (const chunk of isbnChunks) {
    const found = await database
      .select({ id: books.id, isbn: books.isbn })
      .from(books)
      .where(inArray(books.isbn, chunk));
    for (const b of found) {
      existingMap.set(b.isbn, b.id);
    }
  }

  // 2. Pisahkan data baru vs pembaruan
  const toInsert: Array<typeof books.$inferInsert> = [];
  const toUpdate: Array<{ id: string; values: Partial<typeof books.$inferInsert> }> = [];
  const itemBookIdMap = new Map<string, string>(); // resolvedIsbn -> bookId

  for (const item of normalizedItems) {
    const existingId = existingMap.get(item.resolvedIsbn);
    if (existingId) {
      itemBookIdMap.set(item.resolvedIsbn, existingId);
      toUpdate.push({
        id: existingId,
        values: {
          title: item.title,
          author: item.author || "Tim Al-Wildan",
          publisher: item.publisher || "Penerbit Al-Wildan",
          publishYear: item.publishYear,
          category: item.category || null,
          description: item.description || null,
          price: item.effectivePrice,
          sellPrice: item.effectivePrice,
          buyPrice: item.effectiveBuyPrice,
          updatedAt: nowIso,
        },
      });
    } else {
      const newId = item.id || crypto.randomUUID();
      itemBookIdMap.set(item.resolvedIsbn, newId);
      toInsert.push({
        id: newId,
        isbn: item.resolvedIsbn,
        title: item.title,
        author: item.author || "Tim Al-Wildan",
        publisher: item.publisher || "Penerbit Al-Wildan",
        publishYear: item.publishYear,
        category: item.category || null,
        description: item.description || null,
        price: item.effectivePrice,
        sellPrice: item.effectivePrice,
        buyPrice: item.effectiveBuyPrice,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }

  // 3. Batch insert buku dengan chunkRows (maks 10 baris per batch D1)
  const insertChunks = chunkRows(toInsert, 10);
  for (const chunk of insertChunks) {
    await database.insert(books).values(chunk);
    insertedCount += chunk.length;
  }

  // 4. Update baris buku yang sudah ada
  for (const u of toUpdate) {
    await database
      .update(books)
      .set(u.values)
      .where(inArray(books.id, [u.id]));
    updatedCount++;
  }

  // 5. Otomatisasi pembentukan Paket Buku (BOM) per tingkat & kurikulum bila diminta
  if (options?.autoCreatePackages) {
    const packageGroups = new Map<string, Array<{ bookId: string; price: number }>>();

    for (const item of normalizedItems) {
      const bookId = itemBookIdMap.get(item.resolvedIsbn);
      if (!bookId) continue;

      const groupKey = `${item.gradeLevel}__${item.curriculumType}`;
      if (!packageGroups.has(groupKey)) {
        packageGroups.set(groupKey, []);
      }
      packageGroups.get(groupKey)!.push({ bookId, price: item.effectivePrice });
    }

    for (const [groupKey, bookComponents] of packageGroups.entries()) {
      const [gradeLevel, curriculumType] = groupKey.split("__") as [string, "international" | "national"];
      const codeSuffix = curriculumType === "international" ? "INT" : "NAT";
      const packageCode = `PKG-SD${gradeLevel}-${codeSuffix}-${academicYear.replace("/", "-")}`;
      const packageName = `Paket Buku Kelas ${gradeLevel} ${curriculumType === "international" ? "Internasional" : "Nasional Plus"} TA ${academicYear}`;
      const totalPrice = bookComponents.reduce((sum, b) => sum + b.price, 0);

      // Cek apakah paket sudah ada
      const [existingPkg] = await database
        .select({ id: bookPackages.id })
        .from(bookPackages)
        .where(eq(bookPackages.code, packageCode));

      let pkgId = existingPkg?.id;
      if (!pkgId) {
        pkgId = crypto.randomUUID();
        await database.insert(bookPackages).values({
          id: pkgId,
          code: packageCode,
          name: packageName,
          gradeLevel,
          curriculumType,
          academicYear,
          price: totalPrice,
          description: `Paket bundling otomatis dari import katalog TA ${academicYear}`,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        packagesCreatedCount++;
      } else {
        await database
          .update(bookPackages)
          .set({
            name: packageName,
            price: totalPrice,
            updatedAt: nowIso,
          })
          .where(eq(bookPackages.id, pkgId));
      }

      // Bersihkan dan masukkan ulang komponen BOM
      await database.delete(bookPackageItems).where(eq(bookPackageItems.packageId, pkgId));
      const bomRows = bookComponents.map((c) => ({
        id: crypto.randomUUID(),
        packageId: pkgId,
        bookId: c.bookId,
        quantity: 1,
        createdAt: nowIso,
      }));

      const bomChunks = chunkRows(bomRows, 10);
      for (const bChunk of bomChunks) {
        await database.insert(bookPackageItems).values(bChunk);
      }
    }
  }

  return {
    insertedCount,
    updatedCount,
    packagesCreatedCount,
    total: items.length,
  };
}

