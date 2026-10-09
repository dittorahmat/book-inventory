import { eq, desc } from "drizzle-orm";
import { db } from "../../db";
import {
  purchaseOrderItems,
  purchaseOrderReceipts,
  purchaseOrderReceiptItems,
  books,
} from "../../db/schema";
import { receivePurchaseOrder, type ReceivedItemInput } from "./po-workflow";

export interface CreatePoReceiptInput {
  deliveryNoteNumber: string;
  receivedDate?: string;
  notes?: string;
  receivedByUserId?: string;
  receivedItems: ReceivedItemInput[];
}

export async function recordPoReceipt(poId: string, input: CreatePoReceiptInput) {
  if (!input.deliveryNoteNumber?.trim()) {
    return { ok: false, status: 400 as const, message: "Nomor Surat Jalan supplier wajib diisi" };
  }

  // 1. Jalankan proses penerimaan stok fisik dan update PO/items
  const receiveResult = await receivePurchaseOrder(poId, input.receivedItems);
  if (!receiveResult.ok) {
    return receiveResult;
  }

  const now = new Date().toISOString();
  const receiptId = crypto.randomUUID();

  // 2. Simpan record Surat Jalan
  await db.insert(purchaseOrderReceipts).values({
    id: receiptId,
    purchaseOrderId: poId,
    deliveryNoteNumber: input.deliveryNoteNumber.trim(),
    receivedDate: input.receivedDate || now.split("T")[0],
    receivedByUserId: input.receivedByUserId || null,
    notes: input.notes || null,
    createdAt: now,
  });

  // 3. Simpan baris item yang diterima pada Surat Jalan ini
  const poItems = await db
    .select({ id: purchaseOrderItems.id, bookId: purchaseOrderItems.bookId })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId));
  const poItemMap = new Map(poItems.map((p: { id: string; bookId: string }) => [p.id, p.bookId]));

  for (const item of input.receivedItems) {
    const bookId = poItemMap.get(item.poItemId);
    if (bookId && item.quantityToReceive > 0) {
      await db.insert(purchaseOrderReceiptItems).values({
        id: crypto.randomUUID(),
        receiptId,
        bookId,
        quantityReceived: item.quantityToReceive,
        createdAt: now,
      });
    }
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

export async function getPoReceiptHistory(poId: string) {
  const receipts = await db
    .select()
    .from(purchaseOrderReceipts)
    .where(eq(purchaseOrderReceipts.purchaseOrderId, poId))
    .orderBy(desc(purchaseOrderReceipts.createdAt));

  const results = [];
  for (const r of receipts) {
    const items = await db
      .select({
        id: purchaseOrderReceiptItems.id,
        bookId: purchaseOrderReceiptItems.bookId,
        title: books.title,
        isbn: books.isbn,
        quantityReceived: purchaseOrderReceiptItems.quantityReceived,
      })
      .from(purchaseOrderReceiptItems)
      .innerJoin(books, eq(purchaseOrderReceiptItems.bookId, books.id))
      .where(eq(purchaseOrderReceiptItems.receiptId, r.id));

    results.push({
      ...r,
      items,
    });
  }

  return results;
}
