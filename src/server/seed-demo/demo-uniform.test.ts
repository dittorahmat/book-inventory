import { describe, expect, it } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  students,
  uniformExchanges,
  uniformOrders,
  uniformPoItems,
  uniformPos,
  uniformRefunds,
  uniformRejects,
  uniformStock,
} from "../../db/schema";
import { seedDemoUniform } from "./demo-uniform";

const now = new Date().toISOString();

describe("seed demo: operasi seragam", () => {
  it("mengisi status bayar, PO parsial, reject, dan antrean tukar/refund", async () => {
    await seedDemoUniform({ db, now });

    const orders = await db
      .select()
      .from(uniformOrders)
      .where(inArray(uniformOrders.id, ["ord-demo-uso-01", "ord-demo-uso-02", "ord-demo-uso-03", "ord-demo-uso-04"]));
    const byId = new Map(orders.map((order) => [order.id, order]));
    expect(byId.get("ord-demo-uso-01")?.paymentStatus).toBe("partial");
    expect(byId.get("ord-demo-uso-01")?.paidAmount).toBe(100000);
    expect(byId.get("ord-demo-uso-02")?.paymentStatus).toBe("paid");
    expect(byId.get("ord-demo-uso-02")?.shipmentStatus).toBe("sudah_dikirim");
    expect(byId.get("ord-demo-uso-03")?.paymentStatus).toBe("unpaid");
    expect(byId.get("ord-demo-uso-04")?.invoiceSentAt).toBeNull();

    const [po] = await db.select().from(uniformPos).where(eq(uniformPos.id, "upo-demo-02"));
    expect(po.status).toBe("partially_received");
    const lines = await db.select().from(uniformPoItems).where(eq(uniformPoItems.poId, "upo-demo-02"));
    expect(lines).toHaveLength(2);
    expect(lines.some((line) => line.quantityReceived > 0 && line.quantityReceived < line.quantityOrdered)).toBe(true);

    const rejects = await db.select().from(uniformRejects).where(eq(uniformRejects.id, "ur-demo-01"));
    expect(rejects).toHaveLength(1);

    const exchanges = await db.select().from(uniformExchanges);
    expect(exchanges.some((row) => row.status === "requested")).toBe(true);
    expect(exchanges.some((row) => row.status === "completed")).toBe(true);
    const refunds = await db.select().from(uniformRefunds);
    expect(refunds.some((row) => row.status === "requested")).toBe(true);
    expect(refunds.some((row) => row.status === "refunded")).toBe(true);

    const [farhan] = await db.select().from(students).where(eq(students.id, "std-farhan-3"));
    expect(farhan.hasTakenUniform).toBe(true);

    const [sizeM] = await db
      .select()
      .from(uniformStock)
      .where(and(eq(uniformStock.variantId, "uv-demo-ol-sd-m"), eq(uniformStock.size, "M")));
    const [sizeL] = await db
      .select()
      .from(uniformStock)
      .where(and(eq(uniformStock.variantId, "uv-demo-ol-sd-m"), eq(uniformStock.size, "L")));
    expect(sizeM.quantity).toBe(16);
    expect(sizeL.quantity).toBe(14);
  });
});
