import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  bookItems,
  internalPurchaseOrderItems,
  internalPurchaseOrders,
  internalShipmentItems,
  internalShipments,
  transferShipments,
} from "../../db/schema";
import { seedDemoLogistics } from "./demo-logistics";

const now = new Date().toISOString();

describe("seed demo: logistik internal", () => {
  it("mengisi IPO, surat jalan, selisih, push distribution, dan transfer", async () => {
    await seedDemoLogistics({ db, now });

    const pos = await db.select().from(internalPurchaseOrders);
    const poById = new Map(pos.map((row) => [row.id, row]));
    expect(poById.get("ipo-demo-01")?.status).toBe("submitted");
    expect(poById.get("ipo-demo-02")?.status).toBe("partial_fulfilled");

    const poLines = await db.select().from(internalPurchaseOrderItems);
    const lineById = new Map(poLines.map((row) => [row.id, row]));
    expect(lineById.get("ipoi-demo-02-1")?.quantityFulfilled).toBe(2);
    expect(lineById.get("ipoi-demo-01-1")?.quantityFulfilled).toBe(0);

    const shipments = await db.select().from(internalShipments);
    const byId = new Map(shipments.map((row) => [row.id, row]));
    expect(byId.get("ishp-demo-01")?.status).toBe("in_transit");
    expect(byId.get("ishp-demo-02")?.status).toBe("delivered");
    expect(byId.get("ishp-demo-03")?.status).toBe("delivered");
    expect(byId.get("ishp-demo-04")?.status).toBe("discrepancy");
    expect(byId.get("ishp-demo-05")?.notes).toContain("[Push Distribution]");
    expect(byId.get("ishp-demo-02")?.deliveryProofUrl?.startsWith("data:image/svg+xml")).toBe(true);

    const deliveryItems = await db
      .select()
      .from(internalShipmentItems)
      .where(eq(internalShipmentItems.shipmentId, "ishp-demo-03"));
    expect(deliveryItems.reduce((sum, row) => sum + row.quantity, 0)).toBe(10);
    const discrepancyItems = await db
      .select()
      .from(internalShipmentItems)
      .where(eq(internalShipmentItems.shipmentId, "ishp-demo-04"));
    expect(discrepancyItems.some((row) => row.receivedCondition === "damaged")).toBe(true);

    const transfers = await db.select().from(transferShipments);
    const transferById = new Map(transfers.map((row) => [row.id, row]));
    expect(transferById.get("trf-demo-01")?.status).toBe("draft");
    expect(transferById.get("trf-demo-02")?.status).toBe("in_transit");
    expect(transferById.get("trf-demo-03")?.status).toBe("completed");

    const [inTransitItem] = await db
      .select()
      .from(bookItems)
      .where(and(eq(bookItems.id, "bi-loose-b-arab-1-19"), eq(bookItems.status, "in_transit")));
    expect(inTransitItem).toBeDefined();
    const [movedItem] = await db.select().from(bookItems).where(eq(bookItems.id, "bi-loose-b-tahfidz-1-19"));
    expect(movedItem.currentSchoolId).toBe("school-alw-2");
  });
});
