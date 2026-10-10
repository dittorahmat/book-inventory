import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  bookItems,
  books,
  purchaseOrderItems,
  purchaseOrderReceipts,
  purchaseOrderReceiptItems,
  purchaseOrders,
} from "../../db/schema";
import { chunkRows, D1_WRITE_CHUNK_SIZE, d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import type { ReceivedItemInput, ReceivePoResult } from "./po-workflow";

export interface CreatePoReceiptInput {
  deliveryNoteNumber: string;
  receivedDate?: string;
  notes?: string;
  receivedByUserId?: string;
  receivedItems: ReceivedItemInput[];
}

export interface PoReceivePlanDeps {
  now?: string;
  generateId?: () => string;
}

export interface PlannedPoReceive {
  itemUpdates: Array<{ poItemId: string; quantityReceived: number }>;
  stockRows: Array<typeof bookItems.$inferInsert>;
  totalReceivedThisBatch: number;
  newStatus: "received" | "partially_received";
}

export type PoReceivePlanResult =
  | { ok: true; plan: PlannedPoReceive }
  | { ok: false; status: 400; message: string };

/**
 * Perencana murni intake Supplier PO: validasi keanggotaan item + sisa
 * kuantitas sebelum tulis apa pun (400, bukan 500), lalu susun write-set
 * stok + status. Dipakai receivePurchaseOrder dan recordPoReceipt agar
 * kedua jalan mengeksekusi tepat satu rencana yang sama.
 */
export const planPoReceive = (
  po: { poNumber: string; targetSchoolId: string },
  poItems: Array<{ id: string; bookId: string; quantityOrdered: number; quantityReceived: number }>,
  receivedItems: ReceivedItemInput[],
  deps?: PoReceivePlanDeps
): PoReceivePlanResult => {
  const now = deps?.now ?? new Date().toISOString();
  const poItemById = new Map(poItems.map((it) => [it.id, it]));

  const increments = new Map<string, number>();
  for (const rec of receivedItems) {
    const poItem = poItemById.get(rec.poItemId);
    if (!poItem) {
      return { ok: false, status: 400, message: `Item PO tidak valid untuk ${po.poNumber}` };
    }
    const next = (increments.get(rec.poItemId) ?? 0) + rec.quantityToReceive;
    const remaining = poItem.quantityOrdered - poItem.quantityReceived;
    if (next > remaining) {
      return { ok: false, status: 400, message: `Jumlah terima melebihi sisa ${remaining} eks untuk PO ${po.poNumber}` };
    }
    increments.set(rec.poItemId, next);
  }

  const epoch = String(Date.parse(now) % 1000000).padStart(6, "0");
  let totalReceivedThisBatch = 0;
  const stockRows: Array<typeof bookItems.$inferInsert> = [];
  for (const [poItemId, qty] of increments) {
    const poItem = poItemById.get(poItemId)!;
    for (let k = 0; k < qty; k++) {
      const newId = deps?.generateId ? deps.generateId() : crypto.randomUUID();
      stockRows.push({
        id: newId,
        bookId: poItem.bookId,
        currentSchoolId: po.targetSchoolId,
        barcode: `INB-PO-${epoch}-${poItemId.replace(/-/g, "").slice(0, 4).toUpperCase()}-${k + 1}-${newId.replace(/-/g, "").slice(0, 4).toUpperCase()}`,
        condition: "new",
        status: "in_stock",
        notes: `Inbound receiving from ${po.poNumber}`,
        createdAt: now,
        updatedAt: now,
      });
      totalReceivedThisBatch++;
    }
  }
  if (totalReceivedThisBatch === 0) {
    return { ok: false, status: 400, message: "Tidak ada item yang diterima" };
  }

  const newStatus: "received" | "partially_received" = poItems.every(
    (item) => item.quantityReceived + (increments.get(item.id) ?? 0) >= item.quantityOrdered
  )
    ? "received"
    : "partially_received";

  return {
    ok: true,
    plan: {
      itemUpdates: [...increments].map(([poItemId, qty]) => ({
        poItemId,
        quantityReceived: poItemById.get(poItemId)!.quantityReceived + qty,
      })),
      stockRows,
      totalReceivedThisBatch,
      newStatus,
    },
  };
};

const loadPoWithItems = async (database: AppDatabase, poId: string) => {
  const [po] = await database.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) return null;
  const items = await database
    .select({
      id: purchaseOrderItems.id,
      bookId: purchaseOrderItems.bookId,
      quantityOrdered: purchaseOrderItems.quantityOrdered,
      quantityReceived: purchaseOrderItems.quantityReceived,
    })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId));
  return { po, items };
};

/**
 * Penerimaan barang fisik inbound dari PO tanpa surat jalan (jalan
 * kompatibilitas di belakang facade po-lifecycle): satu rencana,
 * satu batch atomik.
 */
export async function receivePurchaseOrder(
  database: AppDatabase,
  poId: string,
  receivedItems: ReceivedItemInput[],
  deps?: PoReceivePlanDeps
): Promise<ReceivePoResult> {
  const now = deps?.now ?? new Date().toISOString();
  const loaded = await loadPoWithItems(database, poId);
  if (!loaded) {
    return { ok: false, status: 404, message: "Purchase Order tidak ditemukan" };
  }

  const planned = planPoReceive(
    { poNumber: (loaded.po as { poNumber: string }).poNumber, targetSchoolId: (loaded.po as { targetSchoolId: string }).targetSchoolId },
    loaded.items,
    receivedItems,
    deps
  );
  if (!planned.ok) return planned;

  try {
    await runWriteBatch(database, [
      ...planned.plan.itemUpdates.map((u) =>
        database
          .update(purchaseOrderItems)
          .set({ quantityReceived: u.quantityReceived })
          .where(eq(purchaseOrderItems.id, u.poItemId))
      ),
      ...chunkRows(planned.plan.stockRows, D1_WRITE_CHUNK_SIZE).map((rows) =>
        database.insert(bookItems).values(rows)
      ),
      database
        .update(purchaseOrders)
        .set({ status: planned.plan.newStatus, updatedAt: now })
        .where(eq(purchaseOrders.id, poId)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "mencatat penerimaan");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    data: {
      poId,
      status: planned.plan.newStatus,
      totalReceivedThisBatch: planned.plan.totalReceivedThisBatch,
    },
  };
}

/**
 * Pencatatan Surat Jalan Supplier PO di belakang facade po-lifecycle:
 * terima stok fisik + simpan surat jalan + baris item dalam SATU rencana
 * dan SATU batch atomik (chunk 10 baris) — receipt gagal tidak
 * meninggalkan stok yatim, stok gagal tidak meninggalkan receipt yatim.
 */
export async function recordPoReceipt(
  database: AppDatabase,
  poId: string,
  input: CreatePoReceiptInput,
  deps?: PoReceivePlanDeps
): Promise<
  | { ok: true; data: { receiptId: string; deliveryNoteNumber: string; poId: string; status: string; totalReceivedThisBatch: number } }
  | { ok: false; status: 400 | 404; message: string }
> {
  const note = input.deliveryNoteNumber?.trim();
  if (!note) {
    return { ok: false, status: 400 as const, message: "Nomor Surat Jalan supplier wajib diisi" };
  }

  const now = deps?.now ?? new Date().toISOString();
  const loaded = await loadPoWithItems(database, poId);
  if (!loaded) {
    return { ok: false, status: 404 as const, message: "Purchase Order tidak ditemukan" };
  }
  const poNumber = (loaded.po as { poNumber: string }).poNumber;
  const targetSchoolId = (loaded.po as { targetSchoolId: string }).targetSchoolId;

  const planned = planPoReceive({ poNumber, targetSchoolId }, loaded.items, input.receivedItems, deps);
  if (!planned.ok) return planned;

  const existingNotes = await database
    .select({ deliveryNoteNumber: purchaseOrderReceipts.deliveryNoteNumber })
    .from(purchaseOrderReceipts)
    .where(eq(purchaseOrderReceipts.purchaseOrderId, poId));
  if (existingNotes.some((r: { deliveryNoteNumber: string }) => r.deliveryNoteNumber.trim() === note)) {
    return { ok: false, status: 400 as const, message: `Nomor Surat Jalan ${note} sudah tercatat untuk PO ${poNumber}` };
  }

  const receiptId = deps?.generateId ? deps.generateId() : crypto.randomUUID();
  const poItemMap = new Map<string, string>(loaded.items.map((p: { id: string; bookId: string }) => [p.id, p.bookId]));
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
      ...planned.plan.itemUpdates.map((u) =>
        database
          .update(purchaseOrderItems)
          .set({ quantityReceived: u.quantityReceived })
          .where(eq(purchaseOrderItems.id, u.poItemId))
      ),
      ...chunkRows(planned.plan.stockRows, D1_WRITE_CHUNK_SIZE).map((rows) =>
        database.insert(bookItems).values(rows)
      ),
      database
        .update(purchaseOrders)
        .set({ status: planned.plan.newStatus, updatedAt: now })
        .where(eq(purchaseOrders.id, poId)),
      database.insert(purchaseOrderReceipts).values({
        id: receiptId,
        purchaseOrderId: poId,
        deliveryNoteNumber: note,
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
      deliveryNoteNumber: note,
      poId,
      status: planned.plan.newStatus,
      totalReceivedThisBatch: planned.plan.totalReceivedThisBatch,
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
