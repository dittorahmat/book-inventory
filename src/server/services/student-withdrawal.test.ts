import { describe, it, expect, beforeEach } from "bun:test";
import { db } from "../../db";
import { students, studentBookOrders, schools } from "../../db/schema";
import { createTestStudent, createTestBookOrder } from "../lib/test-fixtures";
import { requestStudentWithdrawal } from "./student-withdrawal";

describe("student-withdrawal unified seam", () => {
  beforeEach(async () => {
    await db.delete(studentBookOrders);
    await db.delete(students);
    await db.delete(schools);

    const student = await createTestStudent(db, {
      id: "std-wd-test",
      name: "Ahmad Withdrawal",
    });

    await createTestBookOrder(db, {
      id: "ord-wd-test",
      orderNumber: "ORD-WD-001",
      studentId: student.id,
      schoolId: student.schoolId,
      paymentStatus: "paid",
      totalAmount: 500000,
      paidAmount: 500000,
    });
  });

  it("handles buku withdrawal through the unified interface", async () => {
    const res = await requestStudentWithdrawal(db, {
      kind: "buku",
      orderId: "ord-wd-test",
      studentId: "std-wd-test",
      reason: "Pindah ke luar kota",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.kind).toBe("buku");
      expect(res.orderNumber).toBe("ORD-WD-001");
    }
  });

  it("validates courierResi for seragam withdrawal", async () => {
    const res = await requestStudentWithdrawal(db, {
      kind: "seragam",
      orderId: "ord-wd-test",
      studentId: "std-wd-test",
      reason: "Pindah sekolah",
    });

    expect(res.ok).toBe(false);
  });

  it("rejects withdrawal request if student not found", async () => {
    const res = await requestStudentWithdrawal(db, {
      kind: "buku",
      orderId: "ord-wd-test",
      studentId: "non-existent-student",
      reason: "Pindah sekolah",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(404);
    }
  });

  it("validates reason length canonical guard", async () => {
    const res = await requestStudentWithdrawal(db, {
      kind: "buku",
      orderId: "ord-wd-test",
      studentId: "std-wd-test",
      reason: "abc",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
    }
  });
});
