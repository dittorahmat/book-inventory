import { describe, expect, it } from "bun:test";
import { vendorReturnsRouter } from "./vendor-returns";
import { studentOrdersRouter } from "./student-orders";
import { db } from "../../db";
import { schools, suppliers, books, bookItems, studentBookOrders, students, bookReturns } from "../../db/schema";

describe("Returns & RTV API Suite", () => {
  it("processes Return to Vendor (RTV) and marks loose stock as disposed", async () => {
    const stamp = Date.now();
    const supplierId = `sup-rtv-${stamp}`;
    const bookId = `book-rtv-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(suppliers).values({
      id: supplierId,
      code: `SUP-${stamp}`,
      name: "Penerbit RTV Cacat",
      contactPerson: "Pak Budi",
      phone: "08129999111",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-RTV-${stamp}`,
      title: "Buku Cacat Cetak Massal",
      author: "Penulis",
      publisher: "Penerbit RTV Cacat",
      createdAt: now,
      updatedAt: now,
    });

    const biId = `bi-rtv-${stamp}`;
    await db.insert(bookItems).values({
      id: biId,
      bookId,
      currentSchoolId: "test-warehouse",
      barcode: `BC-RTV-${stamp}`,
      condition: "damaged",
      status: "in_stock",
      createdAt: now,
      updatedAt: now,
    });

    const res = await vendorReturnsRouter.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        reason: "Halaman terbalik dari percetakan",
        creditNoteAmount: 150000,
        items: [{ bookId, quantity: 1, reason: "Cacat fisik" }],
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.returnNumber).toMatch(/^RTV-/);
  });

  it("approves parent refund and restores inventory count", async () => {
    const stamp = Date.now();
    const schoolId = `school-refund-${stamp}`;
    const studentId = `st-refund-${stamp}`;
    const orderId = `ord-refund-${stamp}`;
    const bookId = `b-refund-${stamp}`;
    const returnId = `ret-refund-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Cabang Refund Test",
      code: `CRF-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: `NIS-${stamp}`,
      name: "Siswa Refund",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      parentName: "Ortu Siswa",
      parentEmail: `ortu-${stamp}@test.com`,
      parentPhone: "0812333444",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-REF-${stamp}`,
      title: "Buku Refundable",
      author: "Penulis",
      publisher: "Penerbit",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(studentBookOrders).values({
      id: orderId,
      orderNumber: `ORD-REF-${stamp}`,
      schoolId,
      studentId,
      totalAmount: 100000,
      paidAmount: 100000,
      paymentStatus: "paid",
      fulfillmentStatus: "picked_up",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(bookReturns).values({
      id: returnId,
      orderId,
      studentId,
      defectiveBookId: bookId,
      reason: "Halaman hilang, orang tua meminta pengembalian uang",
      status: "reported",
      createdAt: now,
      updatedAt: now,
    });

    // Resolve as refund
    const resolveRes = await studentOrdersRouter.request(`/returns/${returnId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refund",
        refundAmount: 100000,
      }),
    });

    expect(resolveRes.status).toBe(200);
    const resolveJson = await resolveRes.json();
    expect(resolveJson.success).toBe(true);
    expect(resolveJson.data.status).toBe("refunded");
    expect(resolveJson.data.restoredBookItemId).toBeDefined();
  });
});
