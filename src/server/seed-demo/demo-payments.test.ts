import { describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  bookPackages,
  bookReturns,
  paymentAllocations,
  paymentReceipts,
  studentBookOrders,
  uniformOrders,
} from "../../db/schema";
import { seedDemoPayments } from "./demo-payments";
import { seedDemoBooks } from "./demo-books";

const now = new Date().toISOString();

describe("seed demo: pembayaran dan invoice", () => {
  it("menyiapkan token bayar, ongkir, struk pending/verified, dan bukti yang bisa dibuka", async () => {
    await seedDemoBooks({ db, now });
    await seedDemoPayments({ db, now });

    const bookOrders = await db
      .select()
      .from(studentBookOrders)
      .where(inArray(studentBookOrders.id, ["ord-nathan-partial", "ord-salsa-loose"]));
    const byId = new Map(bookOrders.map((order) => [order.id, order]));
    const nathan = byId.get("ord-nathan-partial");
    const salsa = byId.get("ord-salsa-loose");
    expect(nathan?.paymentToken).toBe("demo-token-buku-nathan");
    expect(nathan?.shippingCost).toBe(25000);
    expect(salsa?.paymentToken).toBe("demo-token-buku-satuan");
    expect(salsa?.shippingCost).toBe(25000);

    const [pkg] = await db.select().from(bookPackages).where(eq(bookPackages.id, "pkg-sd1-nas"));
    const due = (nathan?.totalAmount ?? 0) + (nathan?.shippingCost ?? 0);
    expect(due).toBe((pkg?.price ?? 0) + 25000);

    const uniformRows = await db
      .select()
      .from(uniformOrders)
      .where(inArray(uniformOrders.id, ["ord-demo-uso-01", "ord-demo-uso-03"]));
    const uniformById = new Map(uniformRows.map((order) => [order.id, order]));
    expect(uniformById.get("ord-demo-uso-01")?.paymentToken).toBe("demo-token-seragam-01");
    expect(uniformById.get("ord-demo-uso-03")?.paymentToken).toBe("demo-token-seragam-03");

    const receipts = await db
      .select()
      .from(paymentReceipts)
      .where(inArray(paymentReceipts.id, ["rcp-nathan-02", "rcp-seragam-01", "rcp-seragam-02"]));
    const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]));
    expect(receiptById.get("rcp-nathan-02")?.verifiedAt).toBeNull();
    expect(receiptById.get("rcp-nathan-02")?.proofUrl?.startsWith("data:image/svg+xml")).toBe(true);
    expect(receiptById.get("rcp-seragam-01")?.verifiedAt).not.toBeNull();
    expect(receiptById.get("rcp-seragam-02")?.verifiedAt).toBeNull();

    const allocations = await db
      .select()
      .from(paymentAllocations)
      .where(inArray(paymentAllocations.id, ["alc-nathan-02", "alc-seragam-01", "alc-seragam-02"]));
    expect(allocations).toHaveLength(3);

    const [returned] = await db.select().from(bookReturns).where(eq(bookReturns.id, "ret-demo-1"));
    expect(returned.photoProofUrl?.startsWith("data:image/svg+xml")).toBe(true);
  });
});
