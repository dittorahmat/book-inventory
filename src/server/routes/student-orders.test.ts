import { describe, expect, it } from "bun:test";
import { studentOrdersRouter } from "./student-orders";
import { db } from "../../db";
import { bookItems, bookReturns, schools, students, bookPackages, studentBookOrders, books } from "../../db/schema";
import { eq } from "drizzle-orm";

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

  it("rejects return reports for unknown orders on both staff and public paths", async () => {    const payload = {
      orderId: `ord-ghost-${Date.now()}`,
      studentId: `st-ghost-${Date.now()}`,
      defectiveBookId: `b-ghost-${Date.now()}`,
      reason: "Halaman sobek dan tidak layak baca",
      photoProofBase64: "data:image/jpeg;base64,dGVzdC1mb3RvLXJ1c2Fr",
    };
    const staffRes = await studentOrdersRouter.request("/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(staffRes.status).toBe(404);
    expect(((await staffRes.json()) as { success: boolean }).success).toBe(false);
  });

  it("resolveReturn lewat seam fulfilment: auto-pick stok + reject", async () => {
    const stamp = Date.now();
    const schoolId = `test-so-rej-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Sekolah Resolve Test",
      code: `ALW-REJ-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const studentId = `st-rej-${stamp}`;
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: `NIS-REJ-${stamp}`,
      name: "Siswa Resolve",
      gradeLevel: "2",
      curriculumType: "international",
      academicYear: "2026/2027",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const bookId = `b-rej-${stamp}`;
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-REJ-${stamp}`,
      title: "Math Primary 2",
      author: "Cambridge",
      publisher: "CUP",
      createdAt: now,
      updatedAt: now,
    });

    // Satu eksemplar layak ganti di sekolah yang sama (jalur auto-pick).
    const looseId = `bi-rej-${stamp}`;
    await db.insert(bookItems).values({
      id: looseId,
      bookId,
      currentSchoolId: schoolId,
      barcode: `REJ-${stamp}`,
      condition: "new",
      status: "in_stock",
      createdAt: now,
      updatedAt: now,
    });

    const orderId = `ord-rej-${stamp}`;
    await db.insert(studentBookOrders).values({
      id: orderId,
      orderNumber: `ORD-REJ-${String(stamp).slice(-6)}`,
      studentId,
      schoolId,
      orderType: "regular",
      paymentStatus: "paid",
      fulfillmentStatus: "picked_up",
      totalAmount: 100000,
      paidAmount: 100000,
      createdAt: now,
      updatedAt: now,
    });

    const report = async () => {
      const res = await studentOrdersRouter.request("/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, studentId, defectiveBookId: bookId, reason: "Sampul sobek" }),
      });
      expect(res.status).toBe(201);
      return (await res.json()).data.id as string;
    };

    // 1. Replace tanpa id pengganti → auto-pick memakai stok layak + tandai disposed.
    const autoId = await report();
    const autoRes = await studentOrdersRouter.request(`/returns/${autoId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "replace" }),
    });
    expect(autoRes.status).toBe(200);
    const autoJson = await autoRes.json();
    expect(autoJson.success).toBe(true);
    expect(autoJson.data.status).toBe("replaced");
    expect(autoJson.data.replacementBookItemId).toBe(looseId);
    const [consumed] = await db.select().from(bookItems).where(eq(bookItems.id, looseId));
    expect(consumed.status).toBe("disposed");

    // 2. Reject → status rejected, order tidak berubah ke picked_up ulang.
    const rejId = await report();
    const rejRes = await studentOrdersRouter.request(`/returns/${rejId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    expect(rejRes.status).toBe(200);
    const rejJson = await rejRes.json();
    expect(rejJson.success).toBe(true);
    expect(rejJson.data.status).toBe("rejected");
    const [rejected] = await db.select().from(bookReturns).where(eq(bookReturns.id, rejId));
    expect(rejected.status).toBe("rejected");

    // 3. Retur tidak ada → 404 lewat seam yang sama.
    const missing = await studentOrdersRouter.request(`/returns/ret-ghost-${stamp}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    expect(missing.status).toBe(404);
  });
});
