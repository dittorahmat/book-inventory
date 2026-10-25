import type { BatchItem } from "drizzle-orm/batch";
import type { AppDatabase } from "../../../db";
import { studentBookOrders, studentOrderItems } from "../../../db/schema";
import { chunkRows } from "../../lib/d1-write";
import { emitChargeQuery } from "../branch-charges";
import { type ReceiptDraft, receiptWriteQueries } from "../payment-ledger";

export interface BookOrderLine {
  bookId: string;
  quantity: number;
  unitPrice: number;
}

export interface BookOrderWriteOptions {
  database: AppDatabase;
  order: typeof studentBookOrders.$inferInsert;
  lines: BookOrderLine[];
  generateItemId?: () => string;
  receiptDraft?: ReceiptDraft | null;
  emitWprCharge?: boolean;
}

/**
 * Single-writer kanonik untuk tabel `student_book_orders` + `student_order_items`.
 * Mengunci penulisan unit_price_snapshot dan batch chunking <= 10.
 */
export function buildBookOrderWriteQueries(options: BookOrderWriteOptions): BatchItem<"sqlite">[] {
  const { database, order, lines, generateItemId, receiptDraft, emitWprCharge } = options;
  const genItemId = generateItemId ?? (() => crypto.randomUUID());

  const itemRows = lines.map((line) => ({
    id: genItemId(),
    orderId: order.id,
    bookId: line.bookId,
    quantity: line.quantity,
    unitPriceSnapshot: line.unitPrice,
    createdAt: order.createdAt,
  }));

  const queries: BatchItem<"sqlite">[] = [
    database.insert(studentBookOrders).values({
      ...order,
      packageId: order.packageId ?? null,
      homeAddressSnapshot: order.homeAddressSnapshot ?? null,
      satuanShipmentStatus: order.satuanShipmentStatus ?? "belum_dikirim",
      scholarshipProofUrl: order.scholarshipProofUrl ?? null,
      financeProofUrl: order.financeProofUrl ?? null,
      parentPhoneManual: order.parentPhoneManual ?? null,
      handoverDate: order.handoverDate ?? null,
      handoverRecipient: order.handoverRecipient ?? null,
      notes: order.notes ?? null,
    }),
    ...chunkRows(itemRows).map((chunk) => database.insert(studentOrderItems).values(chunk)),
  ];

  if (receiptDraft) {
    queries.push(...receiptWriteQueries(database, receiptDraft));
  }

  if (emitWprCharge) {
    queries.push(
      emitChargeQuery(database, {
        schoolId: order.schoolId,
        sourceType: "book_order",
        sourceId: order.id,
        triggerEvent: "order_created",
        goodsAmount: order.totalAmount ?? 0,
      })
    );
  }

  return queries;
}
