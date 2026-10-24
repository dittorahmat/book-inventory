import { eq } from "drizzle-orm";
import {
  bookItems,
  purchaseOrderItems,
  purchaseOrderReceiptItems,
  purchaseOrderReceipts,
  vendorReturnItems,
  vendorReturns,
} from "../../db/schema";
import type { SeedContext } from "./context";

export async function seedDemoProcurementOps({ db: targetDb, now }: SeedContext) {
  await targetDb
    .insert(purchaseOrderReceipts)
    .values({
      id: "por-demo-01",
      purchaseOrderId: "po-demo-001",
      deliveryNoteNumber: "SJ-SUP-202609-001",
      receivedDate: now.slice(0, 10),
      receivedByUserId: "usr-admin-gudang",
      notes: "Penerimaan tahap 1: 40 Mathematics + 40 Science.",
      createdAt: now,
    })
    .onConflictDoNothing();
  const receiptItems = [
    { id: "pori-demo-01-1", bookId: "b-math-1", quantityReceived: 40 },
    { id: "pori-demo-01-2", bookId: "b-sci-1", quantityReceived: 40 },
  ];
  for (const item of receiptItems) {
    await targetDb
      .insert(purchaseOrderReceiptItems)
      .values({
        ...item,
        receiptId: "por-demo-01",
        condition: "good",
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  await targetDb
    .insert(vendorReturns)
    .values({
      id: "rtv-demo-01",
      returnNumber: "RTV-202610-0001",
      supplierId: "sup-erlangga",
      purchaseOrderId: null,
      status: "completed",
      reason: "Kelebihan kiriman dan 3 eksemplar rusak saat pengiriman.",
      creditNoteAmount: 285000,
      handledByUserId: "usr-admin-gudang",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: vendorReturns.id,
      set: { status: "completed", creditNoteAmount: 285000, updatedAt: now },
    });
  await targetDb
    .insert(vendorReturnItems)
    .values({
      id: "rtvi-demo-01-1",
      vendorReturnId: "rtv-demo-01",
      bookId: "b-math-1",
      quantity: 3,
      reason: "Rusak saat pengiriman",
      createdAt: now,
    })
    .onConflictDoNothing();

  for (const itemId of ["bi-loose-b-math-1-16", "bi-loose-b-math-1-17", "bi-loose-b-math-1-18"]) {
    await targetDb
      .update(bookItems)
      .set({ status: "disposed", notes: "Retur ke vendor RTV-202610-0001", updatedAt: now })
      .where(eq(bookItems.id, itemId));
  }

  // Pastikan PO tetap konsisten dengan total penerimaan.
  await targetDb
    .update(purchaseOrderItems)
    .set({ quantityReceived: 40 })
    .where(eq(purchaseOrderItems.id, "poi-demo-1"));
  await targetDb
    .update(purchaseOrderItems)
    .set({ quantityReceived: 40 })
    .where(eq(purchaseOrderItems.id, "poi-demo-2"));
}
