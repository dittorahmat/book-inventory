import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  paymentAllocations,
  paymentReceipts,
  refundSlips,
  studentBookOrders,
  uniformOrders,
} from "../../db/schema";
import { createTestBookOrder, createTestSchool, createTestStudent } from "../lib/test-fixtures";
import { buildReceiptDraft, receiptWriteQueries } from "./payment-ledger";
import { reallocatePaymentToOrder } from "./order-reallocation";

describe("order-reallocation seam", () => {
  it("reallocates payment from old book order to new more expensive book order (partial)", async () => {
    const stamp = `realloc_bk_${Date.now()}`;
    const school = await createTestSchool(db, { id: `sch_${stamp}` });
    const student = await createTestStudent(db, { id: `std_${stamp}`, schoolId: school.id });
    const oldOrderId = `ord_old_${stamp}`;
    const newOrderId = `ord_new_${stamp}`;
    const receiptId = `rcpt_${stamp}`;
    const now = new Date().toISOString();

    // Order lama: Rp 200.000, lunas
    await createTestBookOrder(db, {
      id: oldOrderId,
      orderNumber: `ORD-OLD-${stamp}`,
      studentId: student.id,
      schoolId: school.id,
      totalAmount: 200000,
      paidAmount: 200000,
      paymentStatus: "paid",
      fulfillmentStatus: "waiting_preparation",
    });

    // Buat draft struk bank & alokasi untuk order lama via receiptWriteQueries
    const draftRes = buildReceiptDraft(
      {
        studentId: student.id,
        schoolId: school.id,
        amount: 200000,
        bankName: "BCA",
        referenceNumber: `REF-${stamp}`,
        autoVerify: true,
        allocations: [{ orderId: oldOrderId, kind: "buku", amount: 200000 }],
      },
      now,
      receiptId
    );
    if (!draftRes.ok) throw new Error(draftRes.message);
    for (const q of receiptWriteQueries(db, draftRes.draft)) await q;

    // Order baru: Rp 300.000 (ganti kurikulum lebih mahal)
    await createTestBookOrder(db, {
      id: newOrderId,
      orderNumber: `ORD-NEW-${stamp}`,
      studentId: student.id,
      schoolId: school.id,
      totalAmount: 300000,
      paidAmount: 0,
      paymentStatus: "unpaid",
      fulfillmentStatus: "waiting_preparation",
    });

    const res = await reallocatePaymentToOrder(db, {
      kind: "buku",
      oldOrderId,
      newOrderId,
    });

    expect(res.ok).toBe(true);
    expect(res.reallocatedAmount).toBe(200000);
    expect(res.newOrderPaidAmount).toBe(200000);
    expect(res.refundPendingAmount).toBe(0);

    // Verifikasi order baru berstatus partial
    const [newOrder] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, newOrderId));
    expect(newOrder.paymentStatus).toBe("partial");
    expect(newOrder.paidAmount).toBe(200000);

    // Verifikasi alokasi kini menunjuk ke order baru
    const allocations = await db
      .select()
      .from(paymentAllocations)
      .where(and(eq(paymentAllocations.kind, "buku"), eq(paymentAllocations.orderId, newOrderId)));
    expect(allocations.length).toBe(1);
    expect(allocations[0].amount).toBe(200000);

    // Struk bank tidak terhapus
    const [receipt] = await db.select().from(paymentReceipts).where(eq(paymentReceipts.id, receiptId));
    expect(receipt).toBeDefined();
    expect(receipt.referenceNumber).toBe(`REF-${stamp}`);
  });

  it("reallocates payment to cheaper order and issues refund pending slip (overpaid)", async () => {
    const stamp = `realloc_over_${Date.now()}`;
    const school = await createTestSchool(db, { id: `sch_${stamp}` });
    const student = await createTestStudent(db, { id: `std_${stamp}`, schoolId: school.id });
    const oldOrderId = `ord_old_${stamp}`;
    const newOrderId = `ord_new_${stamp}`;
    const receiptId = `rcpt_${stamp}`;
    const now = new Date().toISOString();

    // Order lama: Rp 400.000
    await createTestBookOrder(db, {
      id: oldOrderId,
      orderNumber: `ORD-OLD-${stamp}`,
      studentId: student.id,
      schoolId: school.id,
      totalAmount: 400000,
      paidAmount: 400000,
      paymentStatus: "paid",
    });

    const draftRes = buildReceiptDraft(
      {
        studentId: student.id,
        schoolId: school.id,
        amount: 400000,
        bankName: "Mandiri",
        referenceNumber: `REF-${stamp}`,
        autoVerify: true,
        allocations: [{ orderId: oldOrderId, kind: "buku", amount: 400000 }],
      },
      now,
      receiptId
    );
    if (!draftRes.ok) throw new Error(draftRes.message);
    for (const q of receiptWriteQueries(db, draftRes.draft)) await q;

    // Order baru: Rp 250.000 (lebih murah)
    await createTestBookOrder(db, {
      id: newOrderId,
      orderNumber: `ORD-NEW-${stamp}`,
      studentId: student.id,
      schoolId: school.id,
      totalAmount: 250000,
      paidAmount: 0,
      paymentStatus: "unpaid",
    });

    const res = await reallocatePaymentToOrder(db, {
      kind: "buku",
      oldOrderId,
      newOrderId,
    });

    expect(res.ok).toBe(true);
    expect(res.reallocatedAmount).toBe(400000);
    expect(res.newOrderPaidAmount).toBe(250000);
    expect(res.refundPendingAmount).toBe(150000);
    expect(res.refundSlipNumber).toBeDefined();

    // Verifikasi order baru berstatus paid penuh
    const [newOrder] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, newOrderId));
    expect(newOrder.paymentStatus).toBe("paid");
    expect(newOrder.paidAmount).toBe(250000);

    // Verifikasi slip refund pending terbit di tabel refund_slips
    const [slip] = await db.select().from(refundSlips).where(eq(refundSlips.slipNumber, res.refundSlipNumber!));
    expect(slip).toBeDefined();
    expect(slip.refundAmount).toBe(150000);
    expect(slip.status).toBe("approved");
  });

  it("copies scholarship proof and approves new uniform order automatically", async () => {
    const stamp = `realloc_sch_${Date.now()}`;
    const school = await createTestSchool(db, { id: `sch_${stamp}` });
    const student = await createTestStudent(db, { id: `std_${stamp}`, schoolId: school.id });
    const oldOrderId = `uord_old_${stamp}`;
    const newOrderId = `uord_new_${stamp}`;
    const now = new Date().toISOString();

    await db.insert(uniformOrders).values({
      id: oldOrderId,
      orderNumber: `USO-OLD-${stamp}`,
      studentId: student.id,
      schoolId: school.id,
      academicYear: "2026/2027",
      homeAddressSnapshot: "Jl. Mawar 123",
      shipmentStatus: "belum_dikirim",
      orderType: "scholarship",
      paymentStatus: "scholarship_pending",
      scholarshipProofUrl: "https://storage.example.com/scholarship-doc.pdf",
      totalAmount: 250000,
      paidAmount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(uniformOrders).values({
      id: newOrderId,
      orderNumber: `USO-NEW-${stamp}`,
      studentId: student.id,
      schoolId: school.id,
      academicYear: "2026/2027",
      homeAddressSnapshot: "Jl. Mawar 123",
      shipmentStatus: "belum_dikirim",
      orderType: "regular",
      paymentStatus: "unpaid",
      totalAmount: 350000,
      paidAmount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const res = await reallocatePaymentToOrder(db, {
      kind: "seragam",
      oldOrderId,
      newOrderId,
    });

    expect(res.ok).toBe(true);

    const [newOrder] = await db.select().from(uniformOrders).where(eq(uniformOrders.id, newOrderId));
    expect(newOrder.orderType).toBe("scholarship");
    expect(newOrder.paymentStatus).toBe("scholarship_pending");
    expect(newOrder.scholarshipProofUrl).toBe("https://storage.example.com/scholarship-doc.pdf");
  });
});
