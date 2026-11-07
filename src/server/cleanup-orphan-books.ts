import { inArray } from "drizzle-orm";
import type { AppDatabase } from "../db";
import {
  bookItems,
  bookPackageItems,
  books,
  bookStocks,
  bookSuppliers,
  internalShipmentItems,
  purchaseOrderItems,
  studentOrderItems,
  transferShipmentItems,
} from "../db/schema";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "./lib/d1-write";

export async function cleanupOrphanDuplicateBooks(targetDb: AppDatabase) {
  // 1. Ambil seluruh buku di packages
  const packageItemsList = await targetDb
    .select({ bookId: bookPackageItems.bookId })
    .from(bookPackageItems);
  const packageBookIdSet = new Set(packageItemsList.map((pi) => pi.bookId));

  // 2. Ambil seluruh buku yang memiliki referensi aktif (stok, order siswa, PO, book items, shipments)
  const [stocks, studentOrders, poItems, bItems, intShip, transShip, allBooks] = await Promise.all([
    targetDb.select({ bookId: bookStocks.bookId, avail: bookStocks.availableQuantity, res: bookStocks.reservedQuantity }).from(bookStocks),
    targetDb.select({ bookId: studentOrderItems.bookId }).from(studentOrderItems),
    targetDb.select({ bookId: purchaseOrderItems.bookId }).from(purchaseOrderItems),
    targetDb.select({ bookId: bookItems.bookId }).from(bookItems),
    targetDb.select({ bookId: internalShipmentItems.bookId }).from(internalShipmentItems),
    targetDb.select({ bookId: transferShipmentItems.bookId }).from(transferShipmentItems),
    targetDb.select().from(books),
  ]);

  const activeBookIdSet = new Set<string>();
  for (const s of stocks) {
    if (s.avail > 0 || s.res > 0) activeBookIdSet.add(s.bookId);
  }
  for (const o of studentOrders) activeBookIdSet.add(o.bookId);
  for (const p of poItems) activeBookIdSet.add(p.bookId);
  for (const b of bItems) activeBookIdSet.add(b.bookId);
  for (const is of intShip) if (is.bookId) activeBookIdSet.add(is.bookId);
  for (const ts of transShip) if (ts.bookId) activeBookIdSet.add(ts.bookId);

  // 3. Cari buku yang judulnya sama dengan buku lain tapi ID-nya tidak masuk paket & tidak aktif
  const titleMap = new Map<string, string[]>();
  for (const b of allBooks) {
    const normTitle = (b.title || "").trim().toUpperCase();
    const list = titleMap.get(normTitle) || [];
    list.push(b.id);
    titleMap.set(normTitle, list);
  }

  const orphanIdsToDelete: string[] = [];
  for (const ids of titleMap.values()) {
    if (ids.length > 1) {
      // Ada duplikat judul
      for (const id of ids) {
        if (!packageBookIdSet.has(id) && !activeBookIdSet.has(id)) {
          orphanIdsToDelete.push(id);
        }
      }
    }
  }

  let purgedCount = 0;
  if (orphanIdsToDelete.length > 0) {
    for (const chunk of chunkRows(orphanIdsToDelete.map((id) => ({ id })))) {
      const ids = chunk.map((c) => c.id);
      // Hapus secara atomik via batch D1 untuk menjaga integritas cascade (§10.3 / §Master CRUD)
      const deleteBatch = [
        targetDb.delete(bookSuppliers).where(inArray(bookSuppliers.bookId, ids)),
        targetDb.delete(bookStocks).where(inArray(bookStocks.bookId, ids)),
        targetDb.delete(books).where(inArray(books.id, ids)),
      ];
      try {
        await runWriteBatch(targetDb, deleteBatch);
      } catch (err) {
        const mapped = d1WriteErrorStatus(err, "pembersihan buku yatim");
        if (mapped) throw new Error(mapped.message);
        throw err;
      }
      purgedCount += ids.length;
    }
  }

  return { purgedCount };
}
