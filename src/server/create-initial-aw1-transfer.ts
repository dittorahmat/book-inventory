import { eq } from "drizzle-orm";
import type { AppDatabase } from "../db";
import {
  books,
  transferShipments,
  transferShipmentItems,
} from "../db/schema";
import { moveInventoryStock } from "./services/stock";
import { matchBookToStock } from "./seed-initial-book-stock";
import type { Aw1BookAllocationItem } from "./extract-aw1-po-allocations";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "./lib/d1-write";

export interface CreateTransferOptions {
  fromSchoolId?: string;
  toSchoolId?: string;
  shipmentNumber?: string;
  notes?: string;
  now?: string;
}

export interface CreateTransferResult {
  ok: boolean;
  shipmentId?: string;
  shipmentNumber?: string;
  totalItems: number;
  totalQuantity: number;
  unmatchedCount: number;
  message?: string;
}

/**
 * Membuat Surat Jalan Transfer konsolidasi (TRF-AW1-2026-INITIAL)
 * dan menginisialisasi saldo stok cabang AW-1 via moveInventoryStock (receipt di cabang).
 */
export async function createInitialAw1TransferShipment(
  database: AppDatabase,
  allocations: Aw1BookAllocationItem[],
  options: CreateTransferOptions = {}
): Promise<CreateTransferResult> {
  const fromSchoolId = options.fromSchoolId || "school-warehouse";
  const toSchoolId = options.toSchoolId || "school-alw-1";
  const shipmentNumber = options.shipmentNumber || "TRF-AW1-2026-INITIAL";
  const notes = options.notes || "Alokasi awal pergerakan buku murid AW-1 TA 2026/2027 dari lembar PO";
  const now = options.now || new Date().toISOString();

  // 1. Ambil katalog buku untuk pencocokan judul
  const allBooks = await database.select().from(books);

  // 2. Agregasi alokasi per buku yang cocok
  const qtyByBook = new Map<string, { bookId: string; unitPrice: number; quantity: number }>();
  let unmatchedCount = 0;

  for (const item of allocations) {
    const matched = matchBookToStock(item.title, item.jenjang, allBooks);
    if (matched) {
      const fullBook = allBooks.find((b) => b.id === matched.id);
      const unitPrice = fullBook && fullBook.buyPrice > 0 ? fullBook.buyPrice : (fullBook?.price || 0);
      const existing = qtyByBook.get(matched.id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        qtyByBook.set(matched.id, { bookId: matched.id, unitPrice, quantity: item.quantity });
      }
    } else {
      unmatchedCount++;
    }
  }

  if (qtyByBook.size === 0) {
    return {
      ok: false,
      message: "Tidak ada baris buku yang cocok dengan katalog.",
      totalItems: 0,
      totalQuantity: 0,
      unmatchedCount,
    };
  }

  // 3. Hitung total nilai declared transfer
  let totalDeclaredValue = 0;
  let totalQuantity = 0;
  for (const entry of qtyByBook.values()) {
    totalQuantity += entry.quantity;
    totalDeclaredValue += entry.unitPrice * entry.quantity;
  }

  // 4. Periksa apakah transferShipment sudah ada (idempoten)
  const [existingShipment] = await database
    .select()
    .from(transferShipments)
    .where(eq(transferShipments.shipmentNumber, shipmentNumber));

  const shipmentId = existingShipment?.id || crypto.randomUUID();

  if (!existingShipment) {
    await database.insert(transferShipments).values({
      id: shipmentId,
      shipmentNumber,
      fromSchoolId,
      toSchoolId,
      status: "completed",
      totalDeclaredValue,
      dispatchedAt: now,
      receivedAt: now,
      notes,
      reason: "Alokasi pergerakan awal buku murid AW-1",
      createdAt: now,
      updatedAt: now,
    });
  }

  // 5. Masukkan item transfer_shipment_items
  const itemsToInsert: (typeof transferShipmentItems.$inferInsert)[] = [];
  for (const entry of qtyByBook.values()) {
    itemsToInsert.push({
      id: crypto.randomUUID(),
      shipmentId,
      itemType: "loose",
      bookId: entry.bookId,
      quantity: entry.quantity,
      unitPriceSnapshot: entry.unitPrice,
      receivedCondition: "good",
      createdAt: now,
    });
  }

  for (const chunk of chunkRows(itemsToInsert)) {
    try {
      await runWriteBatch(
        database,
        chunk.map((item) =>
          database
            .insert(transferShipmentItems)
            .values(item)
            .onConflictDoNothing()
        )
      );
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "item surat jalan transfer");
      if (mapped) throw new Error(mapped.message);
      throw err;
    }
  }

  // 6. Mutasi saldo penerimaan fisik di cabang AW-1 via seam moveInventoryStock
  for (const entry of qtyByBook.values()) {
    const res = await moveInventoryStock(database, {
      movementType: "receipt",
      itemType: "loose",
      bookId: entry.bookId,
      quantity: entry.quantity,
      schoolId: toSchoolId,
      referenceDocumentNumber: shipmentNumber,
      notes: `Penerimaan Surat Jalan Transfer ${shipmentNumber}`,
    });

    if (!res.ok) {
      throw new Error(`Gagal memutasi penerimaan stok cabang untuk ${entry.bookId}: ${res.message}`);
    }
  }

  return {
    ok: true,
    shipmentId,
    shipmentNumber,
    totalItems: qtyByBook.size,
    totalQuantity,
    unmatchedCount,
  };
}
