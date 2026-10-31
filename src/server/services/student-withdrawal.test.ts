import { describe, it, expect, beforeEach } from "bun:test";
import { db } from "../../db";
import { students, studentBookOrders, schools } from "../../db/schema";
import { requestStudentWithdrawal } from "./student-withdrawal";

describe("student-withdrawal unified seam", () => {
  beforeEach(async () => {
    await db.delete(studentBookOrders);
    await db.delete(students);
    await db.delete(schools);

    await db.insert(schools).values({
      id: "sch-wd-test",
      name: "Sekolah Withdrawal Test",
      code: "SWT",
      address: "Jl Test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(students).values({
      id: "std-wd-test",
      schoolId: "sch-wd-test",
      nis: "NIS-WD-001",
      name: "Ahmad Withdrawal",
      gender: "male",
      gradeLevel: "1",
      academicYear: "2026/2027",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(studentBookOrders).values({
      id: "ord-wd-test",
      orderNumber: "ORD-WD-001",
      studentId: "std-wd-test",
      schoolId: "sch-wd-test",
      paymentStatus: "paid",
      fulfillmentStatus: "waiting_preparation",
      orderType: "regular",
      totalAmount: 500000,
      paidAmount: 500000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
