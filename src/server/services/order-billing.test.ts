import { describe, expect, it } from "bun:test";
import { db } from "../../db";
import { books, schools, studentBookOrders, studentOrderItems, students, uniformOrders } from "../../db/schema";
import { eq } from "drizzle-orm";
import { assertInvoiceGate, confirmPayment, lookupByToken, sendInvoice, setShipping } from "./order-billing";

const stubSender = { name: "stub", send: async () => ({ success: true as const }) };
const ts = Date.now();
const suffix = `${ts.toString(36)}${Math.floor(Math.random() * 1e4)}`;

describe("order-billing deep seam (buku|seragam)", () => {
  it("dispatches by kind, preserves 404 texts, gate difference, and volume-safe shipping", async () => {
    const now = new Date().toISOString();
    const schoolId = `school-bil-${suffix}`;
    const studentId = `st-bil-${suffix}`;
    const bookId = `b-bil-${suffix}`;
    const bookOrderId = `ord-bil-${suffix}`;
    const uniformOrderId = `uord-bil-${suffix}`;
    const uuidOrderId = crypto.randomUUID();
    try {
      await db.insert(schools).values({ id: schoolId, name: "Billing Seam Test", code: `BIL-${suffix}`, type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();
      await db.insert(students).values({
        id: studentId, schoolId, nis: `NISBIL${suffix}`, name: "Billing Seam", gradeLevel: "1",
        curriculumType: "international", academicYear: "2026/2027", status: "active",
        parentName: "Ortu", parentEmail: "ortu@example.com", parentPhone: "+628100000001",
        createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
      await db.insert(books).values({ id: bookId, isbn: `ISBN-BIL-${suffix}`, title: "Billing Book", author: "Anon", publisher: "Test", createdAt: now, updatedAt: now }).onConflictDoNothing();
      await db.insert(studentBookOrders).values({
        id: bookOrderId, orderNumber: `ORD-BIL-${suffix}`, studentId, schoolId,
        orderType: "regular", paymentStatus: "unpaid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 100000, paidAmount: 0, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
      await db.insert(studentOrderItems).values({
        id: `li-bil-${suffix}`, orderId: bookOrderId, bookId, quantity: 1, unitPriceSnapshot: 100000, createdAt: now,
      }).onConflictDoNothing();
      await db.insert(uniformOrders).values({
        id: uniformOrderId, orderNumber: `USO-BIL-${suffix}`, studentId, schoolId,
        academicYear: "2026/2027", homeAddressSnapshot: "Jl. Test No. 1 RT 01 RW 02, 12345",
        orderType: "regular", totalAmount: 200000, paidAmount: 0, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
      await db.insert(studentBookOrders).values({
        id: uuidOrderId, orderNumber: `ORD-UUID-${suffix}`, studentId, schoolId,
        orderType: "regular", paymentStatus: "unpaid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 50000, paidAmount: 0, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();

      // 404 texts stay per-kind.
      const missBook = await sendInvoice(db, `nope-${suffix}`, { kind: "buku", sender: stubSender, baseUrl: "https://x.test" });
      const missUniform = await sendInvoice(db, `nope-${suffix}`, { kind: "seragam", sender: stubSender, baseUrl: "https://x.test" });
      expect(missBook.ok).toBe(false);
      if (!missBook.ok) expect(missBook.message).toBe("Pesanan tidak ditemukan.");
      expect(missUniform.ok).toBe(false);
      if (!missUniform.ok) expect(missUniform.message).toBe("Order seragam tidak ditemukan.");

      // Gate difference: satuan book order with warehouse actor passes, school actor blocked; seragam gate is null.
      const gateCentral = await assertInvoiceGate(db, { role: "warehouse_admin", schoolId }, bookOrderId, "buku");
      expect(gateCentral).toBeNull();
      const gateSchool = await assertInvoiceGate(db, { role: "school_admin", schoolId }, bookOrderId, "buku");
      expect(gateSchool?.status).toBe(403);
      expect(await assertInvoiceGate(db, { role: "school_admin", schoolId }, uniformOrderId, "seragam")).toBeNull();

      // Ongkir gate: satuan without shipping refused for both kinds.
      const blockedBook = await sendInvoice(db, bookOrderId, { kind: "buku", sender: stubSender, baseUrl: "https://x.test" });
      expect(blockedBook.ok).toBe(false);
      const blockedUniform = await sendInvoice(db, uniformOrderId, { kind: "seragam", sender: stubSender, baseUrl: "https://x.test" });
      expect(blockedUniform.ok).toBe(false);

      // Shipping validation shared, then send succeeds with kind in URL.
      expect((await setShipping(db, bookOrderId, { shippingCost: -1 }, "buku")).ok).toBe(false);
      expect((await setShipping(db, bookOrderId, { shippingCost: 0, shippingResi: "RESI-1" }, "buku")).ok).toBe(true);
      expect((await setShipping(db, uuidOrderId, { shippingCost: 15000 }, "buku")).ok).toBe(true);
      expect((await setShipping(db, uniformOrderId, { shippingCost: 12000 }, "seragam")).ok).toBe(true);
      const sentBook = await sendInvoice(db, bookOrderId, { kind: "buku", sender: stubSender, baseUrl: "https://x.test" });
      expect(sentBook.ok).toBe(true);
      if (sentBook.ok) expect(sentBook.data.confirmUrl).toContain("/bayar/buku/");
      const sentUniform = await sendInvoice(db, uniformOrderId, { kind: "seragam", sender: stubSender, baseUrl: "https://x.test" });
      expect(sentUniform.ok).toBe(true);
      if (sentUniform.ok) expect(sentUniform.data.confirmUrl).toContain("/bayar/seragam/");

      // Lookup + confirm flow via same seam (30-row volume covered by chunked kernel elsewhere; here token round-trip).
      const [bookRow] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, bookOrderId));
      const found = await lookupByToken(db, bookRow.paymentToken as string, "buku");
      expect(found?.order.id).toBe(bookOrderId);
      expect(found?.due).toBe(100000);
      const badConfirm = await confirmPayment(db, bookRow.paymentToken as string, { transferAmount: 5, allocationAmount: 10 }, "buku");
      expect(badConfirm.ok).toBe(false);
    } finally {
      await db.delete(studentOrderItems).where(eq(studentOrderItems.orderId, bookOrderId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, bookOrderId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, uuidOrderId));
      await db.delete(uniformOrders).where(eq(uniformOrders.id, uniformOrderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
      await db.delete(books).where(eq(books.id, bookId));
    }
  });
});
