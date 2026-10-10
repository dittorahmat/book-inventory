import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  purchaseOrderItems,
  purchaseOrderReceipts,
  purchaseOrderReceiptItems,
  books,
} from "../../db/schema";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import { receivePurchaseOrder, type ReceivedItemInput } from "./po-workflow";

export interface CreatePoReceiptInput {
  deliveryNoteNumber: string;
  receivedDate?: string;
  notes?: string;
  receivedByUserId?: string;
  receivedItems: ReceivedItemInput[];
}

/**
 * Pencatatan Surat Jalan Supplier PO di belakang facade po-lifecycle:
 * terima stok fisik + simpan surat jalan + baris item dalam satu Write Batch
 * (chunk 10 baris) — receipt gagal tidak meninggalkan stok yatim.
 */
export async function recordPoReceipt(
  database: AppDatabase,
  poId: string,
  input: CreatePoReceiptInput
): Promise<
  | { ok: true; data: { receiptId: string; deliveryNoteNumber: string; poId: string; status: string; totalReceivedThisBatch: number } }
  | { ok: false; status: 400 | 404; message: string }
> {
  if (!input.deliveryNoteNumber?.trim()) {
    return { ok: false, status: 400 as const, message: "Nomor Surat Jalan supplier wajib diisi" };
  }

  // 1. Jalankan proses penerimaan stok fisik dan update PO/items
  const receiveResult = await receivePurchaseOrder(database, poId, input.receivedItems);
  if (!receiveResult.ok) {
    return receiveResult;
  }

  const now = new Date().toISOString();
  const receiptId = crypto.randomUUID();

  // 2. Baris item Surat Jalan (satu query, tanpa N+1)
  const poItems = await database
    .select({ id: purchaseOrderItems.id, bookId: purchaseOrderItems.bookId })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId));
  const poItemMap = new Map(poItems.map((p: { id: string; bookId: string }) => [p.id, p.bookId]));
  const receiptItemRows = input.receivedItems
    .filter((item) => (poItemMap.get(item.poItemId) ?? null) && item.quantityToReceive > 0)
    .map((item) => ({
      id: crypto.randomUUID(),
      receiptId,
      bookId: poItemMap.get(item.poItemId)!,
      quantityReceived: item.quantityToReceive,
      createdAt: now,
    }));

  try {
    await runWriteBatch(database, [
      database.insert(purchaseOrderReceipts).values({
        id: receiptId,
        purchaseOrderId: poId,
        deliveryNoteNumber: input.deliveryNoteNumber.trim(),
        receivedDate: input.receivedDate || now.split("T")[0],
        receivedByUserId: input.receivedByUserId || null,
        notes: input.notes || null,
        createdAt: now,
      }),
      ...chunkRows(receiptItemRows).map((chunk) => database.insert(purchaseOrderReceiptItems).values(chunk)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "mencatat Surat Jalan");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    data: {
      receiptId,
      deliveryNoteNumber: input.deliveryNoteNumber.trim(),
      poId,
      status: receiveResult.data.status,
      totalReceivedThisBatch: receiveResult.data.totalReceivedThisBatch,
    },
  };
}

export async function getPoReceiptHistory(
  database: AppDatabase,
  poId: string
): Promise<Array<Record<string, unknown>>> {
  const receipts = await database
    .select()
    .from(purchaseOrderReceipts)
    .where(eq(purchaseOrderReceipts.purchaseOrderId, poId));

  if (receipts.length === 0) return [];
  const receiptIds = receipts.map((r: { id: string }) => r.id);
  const allItems = await database
    .select({
      id: purchaseOrderReceiptItems.id,
      receiptId: purchaseOrderReceiptItems.receiptId,
      bookId: purchaseOrderReceiptItems.bookId,
      title: books.title,
      isbn: books.isbn,
      quantityReceived: purchaseOrderReceiptItems.quantityReceived,
    })
    .from(purchaseOrderReceiptItems)
    .innerJoin(books, eq(purchaseOrderReceiptItems.bookId, books.id))
    .where(inArray(purchaseOrderReceiptItems.receiptId, receiptIds));

  const itemsByReceipt = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const list = itemsByReceipt.get(item.receiptId) ?? [];
    list.push(item);
    itemsByReceipt.set(item.receiptId, list);
  }
  return receipts.map((r: { id: string }) => ({ ...r, items: itemsByReceipt.get(r.id) ?? [] }));
}
