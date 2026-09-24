import { describe, expect, it } from "bun:test";
import { studentOrdersRouter } from "./student-orders";
import { db } from "../../db";
import { schools, students, bookPackages, studentBookOrders, books } from "../../db/schema";

describe("Student Orders Handover Surat Jalan & Return API", () => {
  it("hands over book package with surat jalan and reports/resolves defective book return", async () => {
    const schoolId = "test-so-school";
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Al Wildan Handover Test",
      code: `ALW-SO-${Date.now()}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const studentId = `st-so-${Date.now()}`;
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: "20243001",
      name: "Rizky Pratama",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      status: "active",
      parentName: "Pratama",
      parentEmail: "pratama@example.com",
      parentPhone: "+62812345670",
      createdAt: now,
      updatedAt: now,
    });

    const bookId = `b-def-${Date.now()}`;
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-DEF-${Date.now()}`,
      title: "Science Primary 1",
      author: "Cambridge",
      publisher: "CUP",
      createdAt: now,
      updatedAt: now,
    });

    const pkgId = `pkg-so-${Date.now()}`;
    await db.insert(bookPackages).values({
      id: pkgId,
      code: `PKG-SO-${Date.now()}`,
      name: "Paket Kelas 1 Science",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      price: 900000,
      createdAt: now,
      updatedAt: now,
    });

    const orderId = `ord-so-${Date.now()}`;
    await db.insert(studentBookOrders).values({
      id: orderId,
      orderNumber: `ORD-SO-${Date.now().toString().slice(-6)}`,
      studentId,
      schoolId,
      packageId: pkgId,
      orderType: "regular",
      paymentStatus: "paid",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: 900000,
      paidAmount: 900000,
      createdAt: now,
      updatedAt: now,
    });

    // 1. Handover / Surat Jalan Penyerahan
    const handoverRes = await studentOrdersRouter.request(`/${orderId}/handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientName: "Bpk. Pratama (Orang Tua)",
        notes: "Paket buku diserahkan lengkap di lobby sekolah",
      }),
    });
    expect(handoverRes.status).toBe(200);
    const handoverJson = await handoverRes.json();
    expect(handoverJson.data.fulfillmentStatus).toBe("picked_up");
    expect(handoverJson.data.deliveryNumber).toContain("SJ-SERAH-");

    // 2. Report Defective Book return
    const returnRes = await studentOrdersRouter.request("/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        studentId,
        defectiveBookId: bookId,
        reason: "Halaman 15-20 robek dan cetakan buram",
        photoProofBase64: "data:image/jpeg;base64,dGVzdC1mb3RvLXJ1c2Fr",
      }),
    });
    expect(returnRes.status).toBe(201);
    const returnJson = await returnRes.json();
    const returnId = returnJson.data.id;
    expect(returnJson.data.status).toBe("reported");

    // 3. Resolve Book Return by replacement
    const resolveRes = await studentOrdersRouter.request(`/returns/${returnId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "replace",
      }),
    });
    expect(resolveRes.status).toBe(200);
    const resolveJson = await resolveRes.json();
    expect(resolveJson.success).toBe(true);
  });
});
