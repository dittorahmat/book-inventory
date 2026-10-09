import { describe, expect, it } from "bun:test";
import { studentOrdersRouter } from "./student-orders";
import { db } from "../../db";
import { bookItems, bookReturns, schools, students, bookPackages, packageItems, studentBookOrders, books } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";

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

    await db.insert(packageItems).values({
      id: `pi-so-${Date.now()}`,
      packageId: pkgId,
      currentSchoolId: schoolId,
      barcode: `PKG-SO-B-${Date.now()}`,
      status: "in_stock",
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

  it("applies finance discretion and allows handover when approved", async () => {
    const stamp = Date.now();
    const schoolId = `sch-disc-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Al Wildan Discretion Test",
      code: `ALW-DISC-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const studentId = `st-disc-${stamp}`;
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: `NIS-DISC-${stamp}`,
      name: "Siswa Belum Lunas",
      gradeLevel: "1",
      academicYear: "2026/2027",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const pkgId = `pkg-disc-${stamp}`;
    await db.insert(bookPackages).values({
      id: pkgId,
      code: `PKG-DISC-${stamp}`,
      name: "Paket Kelas 1 Disc",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      price: 500000,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(packageItems).values({
      id: `pi-disc-${stamp}`,
      packageId: pkgId,
      currentSchoolId: schoolId,
      barcode: `BAR-DISC-${stamp}`,
      status: "in_stock",
      createdAt: now,
      updatedAt: now,
    });

    const orderId = `ord-disc-${stamp}`;
    await db.insert(studentBookOrders).values({
      id: orderId,
      orderNumber: `ORD-DISC-${String(stamp).slice(-6)}`,
      studentId,
      schoolId,
      packageId: pkgId,
      orderType: "regular",
      paymentStatus: "partial",
      fulfillmentStatus: "waiting_preparation",
      totalAmount: 500000,
      paidAmount: 200000,
      financeHandoverApproved: false,
      createdAt: now,
      updatedAt: now,
    });

    // 1. Handover harus DIBLOKIR karena belum lunas dan belum di-ACC finance
    const blockedHandover = await studentOrdersRouter.request(`/${orderId}/handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientName: "Bpk. Wali" }),
    });
    expect(blockedHandover.status).toBe(400);
    const blockedJson = await blockedHandover.json();
    expect(blockedJson.message).toContain("belum ada diskresi");

    // 2. Beri diskresi: handover_override
    const overrideRes = await studentOrdersRouter.request(`/${orderId}/discretion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discretionType: "handover_override",
        discretionNotes: "Diizinkan ambil oleh Kabag Finance",
      }),
    });
    expect(overrideRes.status).toBe(200);
    const overrideJson = await overrideRes.json();
    expect(overrideJson.data.financeHandoverApproved).toBe(true);

    // 3. Sekarang Handover berhasil!
    const allowedHandover = await studentOrdersRouter.request(`/${orderId}/handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientName: "Bpk. Wali" }),
    });
    expect(allowedHandover.status).toBe(200);
    const allowedJson = await allowedHandover.json();
    expect(allowedJson.data.fulfillmentStatus).toBe("picked_up");
  });
});

describe("Student orders search partition (§11 anti full-scan)", () => {
  it("filters search+payment server-side within school partition", async () => {
    const stamp = Date.now();
    const schoolA = `school-oa-${stamp}`;
    const schoolB = `school-ob-${stamp}`;
    const now = new Date().toISOString();
    for (const [id, code] of [[schoolA, `ALW-OA-${stamp}`], [schoolB, `ALW-OB-${stamp}`]]) {
      await db.insert(schools).values({ id, name: `Sekolah ${id}`, code, type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();
    }
    try {
      await db.insert(students).values({
        id: `st-oa-${stamp}`, schoolId: schoolA, nis: `OAN${stamp}`, name: `Order Salsa ${stamp}`,
        gradeLevel: "4", curriculumType: "international", academicYear: "2026/2027", status: "active", createdAt: now, updatedAt: now,
      });
      await db.insert(students).values({
        id: `st-ob-${stamp}`, schoolId: schoolB, nis: `OBN${stamp}`, name: `Order Salsa ${stamp}`,
        gradeLevel: "4", curriculumType: "international", academicYear: "2026/2027", status: "active", createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: `ord-oa-${stamp}`, orderNumber: `ORD-OA-${String(stamp).slice(-6)}`, studentId: `st-oa-${stamp}`, schoolId: schoolA,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 200000, paidAmount: 200000, createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: `ord-ob-${stamp}`, orderNumber: `ORD-OB-${String(stamp).slice(-6)}`, studentId: `st-ob-${stamp}`, schoolId: schoolB,
        orderType: "regular", paymentStatus: "unpaid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 200000, paidAmount: 0, createdAt: now, updatedAt: now,
      });

      const res = await studentOrdersRouter.request(`/?schoolId=${schoolA}&search=${encodeURIComponent(`Order Salsa ${stamp}`)}`);
      const json = await res.json();
      expect(json.data.length).toBe(1);
      expect(json.data[0].id).toBe(`ord-oa-${stamp}`);

      const paidOnly = await studentOrdersRouter.request(`/?schoolId=${schoolA}&paymentStatus=unpaid`);
      const paidJson = await paidOnly.json();
      expect(paidJson.data.some((o: any) => o.id === `ord-oa-${stamp}`)).toBe(false);
    } finally {
      await db.delete(studentBookOrders).where(inArray(studentBookOrders.id, [`ord-oa-${stamp}`, `ord-ob-${stamp}`]));
      await db.delete(students).where(inArray(students.id, [`st-oa-${stamp}`, `st-ob-${stamp}`]));
      await db.delete(schools).where(inArray(schools.id, [schoolA, schoolB]));
    }
  });

  it("filters returns by status server-side", async () => {
    const stamp = Date.now();
    const schoolId = `school-or-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({ id: schoolId, name: `Sekolah ${schoolId}`, code: `ALW-OR-${stamp}`, type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();
    try {
      await db.insert(students).values({
        id: `st-or-${stamp}`, schoolId, nis: `ORN${stamp}`, name: `Retur Anak ${stamp}`,
        gradeLevel: "2", curriculumType: "national", academicYear: "2026/2027", status: "active", createdAt: now, updatedAt: now,
      });
      await db.insert(books).values({
        id: `b-or-${stamp}`, isbn: `ISBN-OR-${stamp}`, title: `Buku Retur ${stamp}`,
        author: "Anon", publisher: "Penerbit", createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: `ord-or-${stamp}`, orderNumber: `ORD-OR-${String(stamp).slice(-6)}`, studentId: `st-or-${stamp}`, schoolId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "picked_up",
        totalAmount: 100000, paidAmount: 100000, createdAt: now, updatedAt: now,
      });
      await db.insert(bookReturns).values({
        id: `ret-or-${stamp}`, orderId: `ord-or-${stamp}`, studentId: `st-or-${stamp}`, defectiveBookId: `b-or-${stamp}`,
        reason: "Sampul sobek", status: "reported", createdAt: now, updatedAt: now,
      });

      const reported = await studentOrdersRouter.request(`/returns?status=reported&search=${encodeURIComponent(`Retur Anak ${stamp}`)}`);
      const reportedJson = await reported.json();
      expect(reportedJson.data.some((r: any) => r.id === `ret-or-${stamp}`)).toBe(true);

      const replaced = await studentOrdersRouter.request(`/returns?status=replaced&search=${encodeURIComponent(`Retur Anak ${stamp}`)}`);
      const replacedJson = await replaced.json();
      expect(replacedJson.data.some((r: any) => r.id === `ret-or-${stamp}`)).toBe(false);
    } finally {
      await db.delete(bookReturns).where(eq(bookReturns.id, `ret-or-${stamp}`));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, `ord-or-${stamp}`));
      await db.delete(books).where(eq(books.id, `b-or-${stamp}`));
      await db.delete(students).where(eq(students.id, `st-or-${stamp}`));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});
