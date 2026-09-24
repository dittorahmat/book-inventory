import { describe, expect, it } from "bun:test";
import { paymentsRouter } from "./payments";
import { db } from "../../db";
import { schools, students, bookPackages, studentBookOrders } from "../../db/schema";

describe("Payments & Cashier Verification API", () => {
  it("records partial and full payments, and handles scholarship approval", async () => {
    const schoolId = "test-pay-school";
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Al Wildan Pay Test",
      code: `ALW-PAY-${Date.now()}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const studentId = `st-pay-${Date.now()}`;
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: "20242001",
      name: "Budi Santoso",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const pkgId = `pkg-pay-${Date.now()}`;
    await db.insert(bookPackages).values({
      id: pkgId,
      code: `PKG-PAY-${Date.now()}`,
      name: "Paket Kelas 1 Reguler",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      price: 1000000,
      createdAt: now,
      updatedAt: now,
    });

    const orderId = `ord-pay-${Date.now()}`;
    await db.insert(studentBookOrders).values({
      id: orderId,
      orderNumber: `ORD-PAY-${Date.now().toString().slice(-6)}`,
      studentId,
      schoolId,
      packageId: pkgId,
      orderType: "regular",
      paymentStatus: "unpaid",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: 1000000,
      paidAmount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // 1. Partial payment: transfer 3.000.000 (SPP + Buku), allocate 400.000 for book
    const pay1 = await paymentsRouter.request(`/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transferAmount: 3000000,
        bookAllocationAmount: 400000,
        bankName: "Mandiri",
        referenceNumber: "REF-MND-001",
        notes: "Cicilan ke-1 (SPP + Buku)",
      }),
    });
    expect(pay1.status).toBe(200);
    const pay1Json = await pay1.json();
    expect(pay1Json.data.paidAmount).toBe(400000);
    expect(pay1Json.data.remainingAmount).toBe(600000);
    expect(pay1Json.data.paymentStatus).toBe("partial");

    // 2. Pay remainder: allocate 600.000 -> Status should become paid
    const pay2 = await paymentsRouter.request(`/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transferAmount: 600000,
        bookAllocationAmount: 600000,
        bankName: "Mandiri",
        referenceNumber: "REF-MND-002",
        notes: "Pelunasan sisa tagihan buku",
      }),
    });
    expect(pay2.status).toBe(200);
    const pay2Json = await pay2.json();
    expect(pay2Json.data.paidAmount).toBe(1000000);
    expect(pay2Json.data.remainingAmount).toBe(0);
    expect(pay2Json.data.paymentStatus).toBe("paid");

    // 3. Test Scholarship Approval
    const schOrderId = `ord-sch-${Date.now()}`;
    await db.insert(studentBookOrders).values({
      id: schOrderId,
      orderNumber: `ORD-SCH-${Date.now().toString().slice(-6)}`,
      studentId,
      schoolId,
      packageId: pkgId,
      orderType: "scholarship",
      paymentStatus: "scholarship_pending",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: 0,
      paidAmount: 0,
      scholarshipProofUrl: "/api/media/scholarships/demo.jpg",
      createdAt: now,
      updatedAt: now,
    });

    const schApprove = await paymentsRouter.request(`/orders/${schOrderId}/scholarship`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approve",
        notes: "Surat rekomendasi beasiswa yayasan terverifikasi valid",
      }),
    });
    expect(schApprove.status).toBe(200);
    const schApproveJson = await schApprove.json();
    expect(schApproveJson.data.paymentStatus).toBe("scholarship_approved");
  });
});
