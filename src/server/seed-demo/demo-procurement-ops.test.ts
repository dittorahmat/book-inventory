import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  bookItems,
  purchaseOrderItems,
  purchaseOrderReceiptItems,
  purchaseOrderReceipts,
  vendorReturnItems,
  vendorReturns,
} from "../../db/schema";
import { seedDemoProcurementOps } from "./demo-procurement-ops";

const now = new Date().toISOString();

describe("seed demo: pengadaan lanjutan", () => {
  it("mengisi riwayat penerimaan PO dan retur vendor dengan stok disposed", async () => {
    await seedDemoProcurementOps({ db, now });

    const [receipt] = await db.select().from(purchaseOrderReceipts).where(eq(purchaseOrderReceipts.id, "por-demo-01"));
    expect(receipt.deliveryNoteNumber).toBe("SJ-SUP-202609-001");
    const receiptItems = await db
      .select()
      .from(purchaseOrderReceiptItems)
      .where(eq(purchaseOrderReceiptItems.receiptId, "por-demo-01"));
    expect(receiptItems).toHaveLength(2);
    const receivedTotal = receiptItems.reduce((sum, row) => sum + row.quantityReceived, 0);

    const poLines = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, "po-demo-001"));
    const poTotal = poLines.reduce((sum, row) => sum + row.quantityReceived, 0);
    expect(receivedTotal).toBe(poTotal);

    const [rtv] = await db.select().from(vendorReturns).where(eq(vendorReturns.id, "rtv-demo-01"));
    expect(rtv.status).toBe("completed");
    expect(rtv.creditNoteAmount).toBe(285000);
    const rtvItems = await db.select().from(vendorReturnItems).where(eq(vendorReturnItems.vendorReturnId, "rtv-demo-01"));
    expect(rtvItems).toHaveLength(1);

    for (const itemId of ["bi-loose-b-math-1-16", "bi-loose-b-math-1-17", "bi-loose-b-math-1-18"]) {
      const [item] = await db.select().from(bookItems).where(eq(bookItems.id, itemId));
      expect(item.status).toBe("disposed");
    }
  });
});
