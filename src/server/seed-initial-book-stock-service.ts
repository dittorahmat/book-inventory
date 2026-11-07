import { parseRekapAw1Stock, matchBookToStock } from "./seed-initial-book-stock";
import type { AppDatabase } from "../db";
import { books } from "../db/schema";
import { moveInventoryStock } from "./services/stock";

export interface SeedStockOptions {
  schoolId?: string;
  referenceDoc?: string;
  notes?: string;
}

export interface SeedStockResult {
  totalRowsParsed: number;
  matchedCount: number;
  uniqueBooksCount: number;
  totalQuantity: number;
}

/**
 * Seeder kanonik saldo stok awal buku dari lembar rekapitulasi.
 * Menggunakan titik masuk tunggal moveInventoryStock sesuai §0.62.1.
 */
export async function seedInitialBookStock(
  targetDb: AppDatabase,
  csvContent: string,
  options: SeedStockOptions = {}
): Promise<SeedStockResult> {
  const schoolId = options.schoolId || "school-warehouse";
  const referenceDoc = options.referenceDoc || "REKAP-AW1-2026-2027";
  const notes = options.notes || "Saldo Awal Audit TA 2026/2027 dari Rekapitulasi AW-1";

  const parsedItems = parseRekapAw1Stock(csvContent);

  const allBooks = await targetDb
    .select({
      id: books.id,
      title: books.title,
    })
    .from(books);

  const stockByBook = new Map<string, number>();
  let matchedCount = 0;

  for (const item of parsedItems) {
    const matched = matchBookToStock(item.sheetTitle, item.section, allBooks);
    if (matched) {
      matchedCount++;
      stockByBook.set(matched.id, (stockByBook.get(matched.id) || 0) + item.stockQuantity);
    }
  }

  let totalQuantity = 0;

  // Jalankan mutasi melalui seam kanonik moveInventoryStock
  for (const [bookId, qty] of stockByBook.entries()) {
    totalQuantity += qty;
    const res = await moveInventoryStock(targetDb, {
      movementType: "adjustment",
      itemType: "loose",
      bookId,
      quantity: qty,
      schoolId,
      reason: "audit_reconciliation",
      referenceDocumentNumber: referenceDoc,
      notes,
    });

    if (!res.ok) {
      throw new Error(`Gagal memutasi stok awal untuk buku ${bookId}: ${res.message}`);
    }
  }

  return {
    totalRowsParsed: parsedItems.length,
    matchedCount,
    uniqueBooksCount: stockByBook.size,
    totalQuantity,
  };
}
