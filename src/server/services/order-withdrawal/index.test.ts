import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { bookReturns, refundSlips, studentBookOrders } from "../../../db/schema";
import { approveStudentWithdrawal, submitStudentWithdrawal } from "./index";
import { findRefundSlip } from "../refund-slip";
import { dropSeed, seedBook, seedSchool, seedStudent } from "../../lib/test-seed";

describe("order-withdrawal deep engine (Ticket 03)", () => {
  const seedPrefix = `wdr_${Date.now()}`;
  const orderId = `ord_${seedPrefix}`;

  it("handles complete withdrawal submission and approval lifecycle", async () => {
    const schoolId = await seedSchool(seedPrefix);
    const studentId = await seedStudent(seedPrefix, schoolId);
    const bookId = await seedBook(seedPrefix);
    const now = new Date().toISOString();

    await db.insert(studentBookOrders).values({
      id: orderId,
      orderNumber: `ORD-${Date.now()}`,
      studentId,
      schoolId,
      orderType: "regular",
      totalAmount: 500000,
      paidAmount: 500000,
      paymentStatus: "paid",
      fulfillmentStatus: "waiting_preparation",
      createdAt: now,
      updatedAt: now,
    });

    try {
      // 2. Submit withdrawal
      const submitRes = await submitStudentWithdrawal(db, {
        kind: "buku",
        orderId,
        studentId,
        reason: "Pindah domisili ke luar kota",
      });

      expect(submitRes.ok).toBe(true);
      if (!submitRes.ok) return;
      expect(submitRes.returnId).toBeDefined();

      // 3. Approve withdrawal
      const approveRes = await approveStudentWithdrawal(db, {
        kind: "buku",
        returnId: submitRes.returnId!,
      });

      expect(approveRes.ok).toBe(true);
      if (!approveRes.ok) return;
      expect(approveRes.slip.slipNumber).toMatch(/^RET-B-/);

      // Verify order cancelled and slip created
      const [cancelledOrder] = await db
        .select()
        .from(studentBookOrders)
        .where(eq(studentBookOrders.id, orderId));
      expect(cancelledOrder.fulfillmentStatus).toBe("return_in_progress");

      const slipInDb = await findRefundSlip(db, approveRes.slip.slipNumber);
      expect(slipInDb).not.toBeNull();
      expect(slipInDb?.refundAmount).toBe(500000);
    } finally {
      await db.delete(refundSlips).where(eq(refundSlips.orderId, orderId));
      await db.delete(bookReturns).where(eq(bookReturns.orderId, orderId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await dropSeed({ schoolIds: [schoolId], studentIds: [studentId], bookIds: [bookId] });
    }
  });

  it("validates reason length canonical guard", async () => {
    const res = await submitStudentWithdrawal(db, {
      kind: "buku",
      orderId: "any",
      studentId: "any",
      reason: "pend",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
    }
  });
});
