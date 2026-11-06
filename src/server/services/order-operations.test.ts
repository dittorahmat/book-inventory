import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mockActor, restoreActor } from "../routes/test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => restoreActor());

import { studentOrdersRouter } from "../routes/student-orders";
import { db } from "../../db";
import { studentBookOrders } from "../../db/schema";
import { eq } from "drizzle-orm";
import { guardScopedOrderMutation, transitionOrder } from "./order-operations";
import { dropSeed, seedSchool, seedStudent } from "../lib/test-seed";

const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

describe("order-operations seam (scope + paket-vs-satuan gate)", () => {
  it("blocks cross-gate actors and preserves 404", async () => {
    const now = new Date().toISOString();
    const schoolId = await seedSchool(`ops-${suffix}`, "Ops Test");
    const otherId = await seedSchool(`ops2-${suffix}`, "Ops Other");
    const studentId = await seedStudent(`ops-${suffix}`, schoolId, "Ops Murid");
    const orderId = `ord-ops-${suffix}`;
    try {
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-OPS-${suffix}`, studentId, schoolId,
        orderType: "regular", paymentStatus: "unpaid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 10000, paidAmount: 0, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();

      // Gudang cannot handover paket (paket wajib via cabang).
      mockActor("warehouse_admin", schoolId);
      const wh = await studentOrdersRouter.request(`/${orderId}/handover`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: "Ortu" }),
      });
      expect(wh.status).toBe(403);

      // Sekolah cannot input ongkir satuan (satuan wajib via gudang).
      mockActor("school_admin", schoolId);
      const sch = await studentOrdersRouter.request(`/${orderId}/shipping`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingCost: 10000 }),
      });
      expect(sch.status).toBe(403);

      // Unknown order stays 404 through the same seam.
      mockActor("central_admin", null);
      const miss = await studentOrdersRouter.request(`/nope-${suffix}/shipping`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingCost: 10000 }),
      });
      expect(miss.status).toBe(404);
      expect(guardScopedOrderMutation).toBeDefined();
      expect(transitionOrder).toBeDefined();
    } finally {
      restoreActor();
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await dropSeed({ schoolIds: [schoolId, otherId], studentIds: [studentId] });
    }
  });

  it("executes discretion and cancel through transitionOrder", async () => {
    const now = new Date().toISOString();
    const sId = await seedSchool(`ops3-${suffix}`, "Ops Test 3");
    const stuId = await seedStudent(`ops3-${suffix}`, sId, "Ops Murid 3");
    const ordId = `ord-ops3-${suffix}`;
    try {
      await db.insert(studentBookOrders).values({
        id: ordId, orderNumber: `ORD-OPS3-${suffix}`, studentId: stuId, schoolId: sId,
        orderType: "regular", paymentStatus: "unpaid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 50000, paidAmount: 0, createdAt: now, updatedAt: now,
      });

      mockActor("central_admin", null);
      const discRes = await studentOrdersRouter.request(`/${ordId}/discretion`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discretionType: "discount", discountAmount: 10000, discretionNotes: "Potongan yayasan" }),
      });
      expect(discRes.status).toBe(200);

      const delRes = await studentOrdersRouter.request(`/${ordId}`, {
        method: "DELETE",
      });
      expect(delRes.status).toBe(200);
    } finally {
      restoreActor();
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, ordId));
      await dropSeed({ schoolIds: [sId], studentIds: [stuId] });
    }
  });
});
