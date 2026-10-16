import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mockActor, restoreActor } from "../routes/test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => restoreActor());

import { studentOrdersRouter } from "../routes/student-orders";
import { db } from "../../db";
import { schools, studentBookOrders, students } from "../../db/schema";
import { eq } from "drizzle-orm";
import { guardScopedOrderMutation } from "./order-operations";

const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

describe("order-operations seam (scope + paket-vs-satuan gate)", () => {
  it("blocks cross-gate actors and preserves 404", async () => {
    const now = new Date().toISOString();
    const schoolId = `school-ops-${suffix}`;
    const otherId = `school-ops2-${suffix}`;
    const studentId = `st-ops-${suffix}`;
    const orderId = `ord-ops-${suffix}`;
    try {
      await db.insert(schools).values({ id: schoolId, name: "Ops Test", code: `OPS-${suffix}`, type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();
      await db.insert(schools).values({ id: otherId, name: "Ops Other", code: `OPO-${suffix}`, type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();
      await db.insert(students).values({
        id: studentId, schoolId, nis: `NISOPS${suffix}`, name: "Ops Murid", gradeLevel: "1",
        curriculumType: "international", academicYear: "2026/2027", status: "active",
        parentName: "Ortu", parentEmail: "o@example.com", parentPhone: "+6281", createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
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
    } finally {
      restoreActor();
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
      await db.delete(schools).where(eq(schools.id, otherId));
    }
  });
});
