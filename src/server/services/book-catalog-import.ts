import { inArray } from "drizzle-orm";
import { books } from "../../db/schema";
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
}

export interface BookImportResult {
  insertedCount: number;
  updatedCount: number;
  total: number;
}

/**
 * Service seam untuk import masal katalog buku yang aman D1 batching.
 */
export async function importBookCatalog(
  database: AppDatabase,
  items: BookImportRow[]
): Promise<BookImportResult> {
  let insertedCount = 0;
  let updatedCount = 0;
  const nowIso = new Date().toISOString();

  // 1. Ekstrak ISBN dan cari buku yang sudah ada dengan batch chunking D1
  const normalizedItems = items.map((item) => ({
    ...item,
    resolvedIsbn: resolveBookIsbn(item.isbn),
    effectivePrice: Math.round(item.sellPrice ?? item.price ?? 0),
    effectiveBuyPrice: Math.round(item.buyPrice ?? item.price ?? 0),
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

  for (const item of normalizedItems) {
    const existingId = existingMap.get(item.resolvedIsbn);
    if (existingId) {
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
      toInsert.push({
        id: item.id || crypto.randomUUID(),
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

  // 3. Batch insert dengan chunkRows (maks 10 baris per batch D1)
  const insertChunks = chunkRows(toInsert, 10);
  for (const chunk of insertChunks) {
    await database.insert(books).values(chunk);
    insertedCount += chunk.length;
  }

  // 4. Update baris yang sudah ada
  for (const u of toUpdate) {
    await database
      .update(books)
      .set(u.values)
      .where(inArray(books.id, [u.id]));
    updatedCount++;
  }

  return {
    insertedCount,
    updatedCount,
    total: items.length,
  };
}
