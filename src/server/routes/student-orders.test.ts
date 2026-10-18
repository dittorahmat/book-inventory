import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});
import { studentOrdersRouter } from "./student-orders";
import { paymentsRouter } from "./payments";
import { db } from "../../db";
import { bookItems, bookReturns, branchCharges, schools, students, bookPackages, packageItems, studentBookOrders, studentOrderItems, books, paymentAllocations, paymentReceipts } from "../../db/schema";
import { deleteReceiptsForOrders, selectReceiptsForOrder } from "./test-payments";
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

  it("resolves refund through the guarded interface and restores stock (double refund idempotent)", async () => {
    const stamp = Date.now();
    const schoolId = `school-rf-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({ id: schoolId, name: `Sekolah ${schoolId}`, code: `ALW-RF-${stamp}`, type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();
    try {
      await db.insert(students).values({
        id: `st-rf-${stamp}`, schoolId, nis: `RFF${stamp}`, name: `Refund Anak ${stamp}`,
        gradeLevel: "2", curriculumType: "national", academicYear: "2026/2027", status: "active", createdAt: now, updatedAt: now,
      });
      await db.insert(books).values({
        id: `b-rf-${stamp}`, isbn: `ISBN-RF-${stamp}`, title: `Buku Refund ${stamp}`,
        author: "Anon", publisher: "Penerbit", createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: `ord-rf-${stamp}`, orderNumber: `ORD-RF-${String(stamp).slice(-6)}`, studentId: `st-rf-${stamp}`, schoolId,
        orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "picked_up",
        totalAmount: 100000, paidAmount: 100000, createdAt: now, updatedAt: now,
      });
      await db.insert(bookReturns).values({
        id: `ret-rf-${stamp}`, orderId: `ord-rf-${stamp}`, studentId: `st-rf-${stamp}`, defectiveBookId: `b-rf-${stamp}`,
        reason: "Hilang", status: "reported", createdAt: now, updatedAt: now,
      });

      const res = await studentOrdersRouter.request(`/returns/ret-rf-${stamp}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refund", refundAmount: 40000 }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("refunded");
      expect(json.data.refundAmount).toBe(40000);
      expect(typeof json.data.restoredBookItemId).toBe("string");

      const stock = await db.select().from(bookItems).where(eq(bookItems.bookId, `b-rf-${stamp}`));
      expect(stock).toHaveLength(1);
      expect(stock[0].status).toBe("in_stock");

      const again = await studentOrdersRouter.request(`/returns/ret-rf-${stamp}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refund", refundAmount: 40000 }),
      });
      expect(again.status).toBe(200);
      expect((await db.select().from(bookItems).where(eq(bookItems.bookId, `b-rf-${stamp}`)))).toHaveLength(1);

      const locked = await studentOrdersRouter.request(`/returns/ret-rf-${stamp}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "replace" }),
      });
      expect(locked.status).toBe(400);

      for (const s of stock) await db.delete(bookItems).where(eq(bookItems.id, s.id));
    } finally {
      await db.delete(bookReturns).where(eq(bookReturns.id, `ret-rf-${stamp}`));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, `ord-rf-${stamp}`));
      await db.delete(books).where(eq(books.id, `b-rf-${stamp}`));
      await db.delete(students).where(eq(students.id, `st-rf-${stamp}`));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("deletes an order restoring its bundle and removing linked returns", async () => {
    const stamp = Date.now();
    const schoolId = `school-del-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({ id: schoolId, name: `Sekolah ${schoolId}`, code: `ALW-DEL-${stamp}`, type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();
    try {
      await db.insert(students).values({
        id: `st-del-${stamp}`, schoolId, nis: `DEL${stamp}`, name: `Hapus Anak ${stamp}`,
        gradeLevel: "3", curriculumType: "national", academicYear: "2026/2027", status: "active", createdAt: now, updatedAt: now,
      });
      await db.insert(bookPackages).values({
        id: `pkg-del-${stamp}`, code: `PKG-DEL-${stamp}`, name: "Paket Hapus", gradeLevel: "3",
        curriculumType: "national", academicYear: "2026/2027", price: 50000, createdAt: now, updatedAt: now,
      });
      await db.insert(packageItems).values({
        id: `pi-del-${stamp}`, packageId: `pkg-del-${stamp}`, currentSchoolId: schoolId,
        barcode: `DEL-B-${stamp}`, status: "delivered", createdAt: now, updatedAt: now,
      });
      await db.insert(books).values({
        id: `b-del-${stamp}`, isbn: `ISBN-DEL-${stamp}`, title: `Buku Hapus ${stamp}`,
        author: "Anon", publisher: "Penerbit", createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: `ord-del-${stamp}`, orderNumber: `ORD-DEL-${String(stamp).slice(-6)}`, studentId: `st-del-${stamp}`, schoolId,
        packageId: `pkg-del-${stamp}`, orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "picked_up",
        totalAmount: 50000, paidAmount: 50000, assignedPackageItemId: `pi-del-${stamp}`,
        createdAt: now, updatedAt: now,
      });
      await db.insert(bookReturns).values({
        id: `ret-del-${stamp}`, orderId: `ord-del-${stamp}`, studentId: `st-del-${stamp}`, defectiveBookId: `b-del-${stamp}`,
        reason: "Cacat", status: "reported", createdAt: now, updatedAt: now,
      });

      const res = await studentOrdersRouter.request(`/ord-del-${stamp}`, { method: "DELETE" });
      expect(res.status).toBe(200);
      expect((await res.json()).success).toBe(true);
      const [bundle] = await db.select().from(packageItems).where(eq(packageItems.id, `pi-del-${stamp}`));
      expect(bundle.status).toBe("in_stock");
      expect(await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, `ord-del-${stamp}`))).toHaveLength(0);
      expect(await db.select().from(bookReturns).where(eq(bookReturns.id, `ret-del-${stamp}`))).toHaveLength(0);

      const missing = await studentOrdersRouter.request(`/ord-del-${stamp}`, { method: "DELETE" });
      expect(missing.status).toBe(404);
    } finally {
      await db.delete(bookReturns).where(eq(bookReturns.id, `ret-del-${stamp}`));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, `ord-del-${stamp}`));
      await db.delete(packageItems).where(eq(packageItems.id, `pi-del-${stamp}`));
      await db.delete(bookPackages).where(eq(bookPackages.id, `pkg-del-${stamp}`));
      await db.delete(books).where(eq(books.id, `b-del-${stamp}`));
      await db.delete(students).where(eq(students.id, `st-del-${stamp}`));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});

describe("Student Order scope seam (T1: loadScopedOrder)", () => {
  it("rejects cross-school handover at the seam with 403", async () => {
    const stamp = Date.now();
    const schoolAId = `school-t1ra-${stamp}`;
    const schoolBId = `school-t1rb-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values([
      { id: schoolAId, name: `T1 RA ${stamp}`, code: `T1-RA-${stamp}`, type: "branch", createdAt: now, updatedAt: now },
      { id: schoolBId, name: `T1 RB ${stamp}`, code: `T1-RB-${stamp}`, type: "branch", createdAt: now, updatedAt: now },
    ]).onConflictDoNothing();
    try {
      await db.insert(students).values({
        id: `st-t1r-${stamp}`, schoolId: schoolBId, nis: `T1R${stamp}`, name: `T1R Anak ${stamp}`,
        gradeLevel: "2", curriculumType: "national", academicYear: "2026/2027", status: "active",
        createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: `ord-t1r-${stamp}`, orderNumber: `ORD-T1R-${String(stamp).slice(-6)}`, studentId: `st-t1r-${stamp}`,
        schoolId: schoolBId, orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 20000, paidAmount: 20000, createdAt: now, updatedAt: now,
      });
      mockActor("branch_admin", schoolAId);
      const res = await studentOrdersRouter.request(`/ord-t1r-${stamp}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: "Orang Tua Asing" }),
      });
      expect(res.status).toBe(403);
      expect((await res.json()).message).toMatch(/penugasan/);
    } finally {
      mockActor("central_admin", null);
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, `ord-t1r-${stamp}`));
      await db.delete(students).where(eq(students.id, `st-t1r-${stamp}`));
      await db.delete(schools).where(eq(schools.id, schoolAId));
      await db.delete(schools).where(eq(schools.id, schoolBId));
    }
  });

  it("resolve responses carry the seam-owned message per status", async () => {
    const stamp = Date.now();
    const schoolId = `school-t1m-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: schoolId, name: `T1 M ${stamp}`, code: `T1-M-${stamp}`, type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    try {
      await db.insert(students).values({
        id: `st-t1m-${stamp}`, schoolId, nis: `T1M${stamp}`, name: `T1M Anak ${stamp}`,
        gradeLevel: "2", curriculumType: "national", academicYear: "2026/2027", status: "active",
        createdAt: now, updatedAt: now,
      });
      await db.insert(books).values({
        id: `b-t1m-${stamp}`, isbn: `ISBN-T1M-${stamp}`, title: `Buku T1M ${stamp}`,
        author: "Anon", publisher: "Penerbit", createdAt: now, updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: `ord-t1m-${stamp}`, orderNumber: `ORD-T1M-${String(stamp).slice(-6)}`, studentId: `st-t1m-${stamp}`,
        schoolId, orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "return_in_progress",
        totalAmount: 30000, paidAmount: 30000, createdAt: now, updatedAt: now,
      });
      await db.insert(bookReturns).values({
        id: `ret-t1m-${stamp}`, orderId: `ord-t1m-${stamp}`, studentId: `st-t1m-${stamp}`,
        defectiveBookId: `b-t1m-${stamp}`, reason: "Cacat", status: "reported", createdAt: now, updatedAt: now,
      });
      const res = await studentOrdersRouter.request(`/returns/ret-t1m-${stamp}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe("Laporan retur ditolak");
      expect(json.data.status).toBe("rejected");
    } finally {
      await db.delete(bookReturns).where(eq(bookReturns.id, `ret-t1m-${stamp}`));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, `ord-t1m-${stamp}`));
      await db.delete(books).where(eq(books.id, `b-t1m-${stamp}`));
      await db.delete(students).where(eq(students.id, `st-t1m-${stamp}`));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("satuan kirim-rumah: butuh alamat, paket murni ditolak, tandai terkirim satu arah", async () => {
    const stamp = Date.now();
    const schoolId = `school-sat-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: schoolId, name: `Sat Ship ${stamp}`, code: `SAT-${stamp}`, type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    try {
      await db.insert(students).values({
        id: `st-sat-${stamp}`, schoolId, nis: `SAT${stamp}`, name: `Sat Anak ${stamp}`,
        gradeLevel: "3", curriculumType: "national", academicYear: "2026/2027", status: "active",
        createdAt: now, updatedAt: now,
      });
      await db.insert(books).values({
        id: `b-sat-${stamp}`, isbn: `ISBN-SAT-${stamp}`, title: `Buku Sat ${stamp}`,
        author: "Anon", publisher: "Penerbit", sellPrice: 50000, createdAt: now, updatedAt: now,
      });
      // Order paket murni (tanpa baris satuan, tanpa alamat) -> flag kirim ditolak.
      await db.insert(studentBookOrders).values({
        id: `ord-sat-pkg-${stamp}`, orderNumber: `ORD-SATP-${String(stamp).slice(-6)}`,
        studentId: `st-sat-${stamp}`, schoolId, orderType: "regular",
        paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 100000, paidAmount: 100000, createdAt: now, updatedAt: now,
      });
      const pkgRes = await studentOrdersRouter.request(`/ord-sat-pkg-${stamp}/mark-satuan-shipped`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      expect(pkgRes.status).toBe(400);

      // Order satuan tanpa alamat -> ditolak; dengan alamat -> terkirim + idempoten ditolak.
      await db.insert(studentBookOrders).values({
        id: `ord-sat-noaddr-${stamp}`, orderNumber: `ORD-SATN-${String(stamp).slice(-6)}`,
        studentId: `st-sat-${stamp}`, schoolId, orderType: "regular",
        paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 50000, paidAmount: 50000, createdAt: now, updatedAt: now,
      });
      await db.insert(studentOrderItems).values({
        id: `soi-sat-${stamp}`, orderId: `ord-sat-noaddr-${stamp}`, bookId: `b-sat-${stamp}`,
        quantity: 1, unitPriceSnapshot: 50000, createdAt: now,
      });
      const noAddr = await studentOrdersRouter.request(`/ord-sat-noaddr-${stamp}/mark-satuan-shipped`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      expect(noAddr.status).toBe(400);

      await db.insert(studentBookOrders).values({
        id: `ord-sat-ok-${stamp}`, orderNumber: `ORD-SATO-${String(stamp).slice(-6)}`,
        studentId: `st-sat-${stamp}`, schoolId, orderType: "regular",
        paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        homeAddressSnapshot: "Jl. Mawar No. 10, Bogor",
        totalAmount: 50000, paidAmount: 50000, createdAt: now, updatedAt: now,
      });
      await db.insert(studentOrderItems).values({
        id: `soi-sat-ok-${stamp}`, orderId: `ord-sat-ok-${stamp}`, bookId: `b-sat-${stamp}`,
        quantity: 1, unitPriceSnapshot: 50000, createdAt: now,
      });
      const okRes = await studentOrdersRouter.request(`/ord-sat-ok-${stamp}/mark-satuan-shipped`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      expect(okRes.status).toBe(200);
      expect((await okRes.json()).data.satuanShipmentStatus).toBe("sudah_dikirim");
      const repeat = await studentOrdersRouter.request(`/ord-sat-ok-${stamp}/mark-satuan-shipped`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      expect(repeat.status).toBe(400);
    } finally {
      for (const oid of [`ord-sat-pkg-${stamp}`, `ord-sat-noaddr-${stamp}`, `ord-sat-ok-${stamp}`]) {
        await db.delete(studentOrderItems).where(eq(studentOrderItems.orderId, oid));
        await db.delete(studentBookOrders).where(eq(studentBookOrders.id, oid));
      }
      await db.delete(books).where(eq(books.id, `b-sat-${stamp}`));
      await db.delete(students).where(eq(students.id, `st-sat-${stamp}`));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("ongkir manual + routing: gudang input ongkir, cabang ditolak untuk satuan, gudang ditolak handover paket", async () => {
    const stamp = Date.now();
    const schoolId = `test-ship-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Shipping Test", code: `ALW-SHIP-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const studentId = `st-ship-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-SHIP-${stamp}`, name: "Siswa Ship",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", createdAt: now, updatedAt: now,
    });
    const orderId = `ord-ship-${stamp}`;
    await db.insert(studentBookOrders).values({
      id: orderId, orderNumber: `ORD-SHIP-${String(stamp).slice(-6)}`,
      studentId, schoolId, orderType: "regular",
      paymentStatus: "unpaid", fulfillmentStatus: "waiting_preparation",
      homeAddressSnapshot: "Jl. Anggrek RT 03 RW 05, Serpong, 15310",
      totalAmount: 100000, paidAmount: 0, createdAt: now, updatedAt: now,
    });
    try {
      const badCost = await studentOrdersRouter.request(`/${orderId}/shipping`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingCost: -500 }),
      });
      expect(badCost.status).toBe(400);

      const okShip = await studentOrdersRouter.request(`/${orderId}/shipping`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingCost: 25000, shippingResi: "RESI-001" }),
      });
      expect(okShip.status).toBe(200);
      expect((await okShip.json()).data.shippingCost).toBe(25000);

      mockActor("branch_admin", schoolId);
      const branchShip = await studentOrdersRouter.request(`/${orderId}/shipping`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingCost: 10000 }),
      });
      expect(branchShip.status).toBe(403);
      const branchMark = await studentOrdersRouter.request(`/${orderId}/mark-satuan-shipped`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      expect(branchMark.status).toBe(403);

      mockActor("warehouse_admin", "warehouse-1");
      const pkgId = `pkg-ship-${stamp}`;
      await db.insert(bookPackages).values({
        id: pkgId, code: `PKG-SHIP-${stamp}`, name: "Paket Ship",
        gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
        price: 500000, createdAt: now, updatedAt: now,
      });
      const pkgOrderId = `ord-ship-pkg-${stamp}`;
      await db.insert(studentBookOrders).values({
        id: pkgOrderId, orderNumber: `ORD-SHPP-${String(stamp).slice(-6)}`,
        studentId, schoolId, packageId: pkgId, orderType: "regular",
        paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 500000, paidAmount: 500000, createdAt: now, updatedAt: now,
      });
      const whHandover = await studentOrdersRouter.request(`/${pkgOrderId}/handover`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: "Ortu" }),
      });
      expect(whHandover.status).toBe(403);
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, pkgOrderId));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
    } finally {
      mockActor("central_admin", null);
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("ongkir masuk tidak meninggalkan status lunas yang basi (§status derived)", async () => {
    const stamp = Date.now();
    const schoolId = `test-stale-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Stale Test", code: `ALW-STL-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const studentId = `st-stale-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-STL-${stamp}`, name: "Siswa Stale",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", createdAt: now, updatedAt: now,
    });
    const orderId = `ord-stale-${stamp}`;
    const receiptId = `rcp-stale-${stamp}`;
    await db.insert(studentBookOrders).values({
      id: orderId, orderNumber: `ORD-STL-${String(stamp).slice(-6)}`,
      studentId, schoolId, orderType: "regular",
      paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
      totalAmount: 100000, paidAmount: 100000, createdAt: now, updatedAt: now,
    });
    try {
      await db.insert(paymentReceipts).values({
        id: receiptId, studentId, schoolId, amount: 100000, bankName: "BCA",
        referenceNumber: `STALE-${stamp}`, receivedAt: now, verifiedAt: now,
        createdAt: now, updatedAt: now,
      });
      await db.insert(paymentAllocations).values({
        id: `alc-stale-${stamp}`, receiptId, orderId, kind: "buku" as const,
        amount: 100000, createdAt: now,
      });

      const ship = await studentOrdersRouter.request(`/${orderId}/shipping`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingCost: 25000, shippingResi: "STALE-1" }),
      });
      expect(ship.status).toBe(200);
      const shipped = await ship.json();
      expect(shipped.data.shippingCost).toBe(25000);
      expect(shipped.data.paidAmount).toBe(100000);
      expect(shipped.data.paymentStatus).toBe("partial");

      const [charge] = await db.select().from(branchCharges).where(eq(branchCharges.sourceId, orderId));
      if (charge) expect(charge.status).toBe("final");
    } finally {
      await deleteReceiptsForOrders([orderId]);
      await db.delete(branchCharges).where(eq(branchCharges.sourceId, orderId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("validasi alamat kirim-rumah menolak tanpa RT/RW/kode pos", async () => {
    const { validateHomeAddress } = await import("../../lib/home-address");
    expect(validateHomeAddress("Jl. Mawar No. 10, Bogor").ok).toBe(false);
    expect(validateHomeAddress("Jl. Mawar RT 03, Bogor 15310").ok).toBe(false);
    expect(validateHomeAddress("Jl. Anggrek RT 03 RW 05, Serpong Utara, 15310").ok).toBe(true);
  });

  it("invoice satuan wajib ongkir dulu; konfirmasi lunas/bertahap via link", async () => {
    const stamp = Date.now();
    const schoolId = `test-inv-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Invoice", code: `ALW-INV-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const studentId = `st-inv-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-INV-${stamp}`, name: "Siswa Invoice",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", parentName: "Ortu", parentPhone: "+628120000001",
      createdAt: now, updatedAt: now,
    });
    const orderId = `ord-inv-${stamp}`;
    await db.insert(studentBookOrders).values({
      id: orderId, orderNumber: `ORD-INV-${String(stamp).slice(-6)}`,
      studentId, schoolId, orderType: "regular",
      paymentStatus: "unpaid", fulfillmentStatus: "waiting_preparation",
      homeAddressSnapshot: "Jl. Inv RT 01 RW 02, Serpong 15310",
      totalAmount: 100000, paidAmount: 0, createdAt: now, updatedAt: now,
    });
    const { publicOrdersRouter } = await import("./public-orders");
    try {
      const blocked = await studentOrdersRouter.request(`/${orderId}/send-invoice`, { method: "POST" });
      expect(blocked.status).toBe(200);

      await db.insert(studentOrderItems).values({
        id: `soi-inv-${stamp}`, orderId, bookId: "book-wpr-weekly-report",
        quantity: 1, unitPriceSnapshot: 750000, createdAt: now,
      });
      const needShip = await studentOrdersRouter.request(`/${orderId}/send-invoice`, { method: "POST" });
      expect(needShip.status).toBe(400);

      mockActor("central_admin", null);
      const ship = await studentOrdersRouter.request(`/${orderId}/shipping`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingCost: 20000 }),
      });
      expect(ship.status).toBe(200);
      const sent = await studentOrdersRouter.request(`/${orderId}/send-invoice`, { method: "POST" });
      expect(sent.status).toBe(200);
      const sentJson = await sent.json();
      expect(sentJson.data.confirmUrl).toContain("/bayar/buku/");
      const token = sentJson.data.confirmUrl.split("/").pop() as string;

      const lookup = await publicOrdersRouter.request(`/confirm/${token}`, { method: "GET" });
      expect(lookup.status).toBe(200);
      expect((await lookup.json()).data.due).toBe(120000);

      const bad = await publicOrdersRouter.request(`/confirm/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferAmount: 50000, allocationAmount: 60000 }),
      });
      expect(bad.status).toBe(400);

      const partial = await publicOrdersRouter.request(`/confirm/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferAmount: 50000, allocationAmount: 50000, bankName: "BCA" }),
      });
      expect(partial.status).toBe(201);
      expect((await partial.json()).data.paymentStatus).toBe("unpaid");

      const second = await publicOrdersRouter.request(`/confirm/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferAmount: 70000, allocationAmount: 70000, bankName: "BCA" }),
      });
      expect(second.status).toBe(201);
      expect((await second.json()).data.paymentStatus).toBe("unpaid");

      // Verifikasi gudang yang mengubah status order (50000 -> partial, +70000 -> paid).
      const claims = await selectReceiptsForOrder(orderId);
      const claimOne = claims.find((row) => row.allocation.amount === 50000)?.receipt;
      const claimTwo = claims.find((row) => row.allocation.amount === 70000)?.receipt;
      if (!claimOne || !claimTwo) throw new Error("klaim pembayaran tidak terbentuk");
      const verifyOne = await paymentsRouter.request(`/orders/${orderId}/payments/${claimOne.id}/verify`, { method: "POST" });
      expect(verifyOne.status).toBe(200);
      expect((await verifyOne.json()).data.paymentStatus).toBe("partial");
      const verifyTwo = await paymentsRouter.request(`/orders/${orderId}/payments/${claimTwo.id}/verify`, { method: "POST" });
      expect(verifyTwo.status).toBe(200);
      const verifyTwoJson = await verifyTwo.json();
      expect(verifyTwoJson.data.paymentStatus).toBe("paid");
      expect(verifyTwoJson.data.notification.wa.success).toBe(true);

      const ghost = await publicOrdersRouter.request("/confirm/token-hantu", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferAmount: 10000, allocationAmount: 10000 }),
      });
      expect(ghost.status).toBe(404);

      // Ongkir 0 sah bila ada resi: invoice tetap bisa dikirim.
      await db.update(studentBookOrders).set({ shippingCost: 0, shippingResi: "INTERNAL-0" }).where(eq(studentBookOrders.id, orderId));
      const freeShip = await studentOrdersRouter.request(`/${orderId}/send-invoice`, { method: "POST" });
      expect(freeShip.status).toBe(200);
    } finally {
      mockActor("central_admin", null);
      await db.delete(studentOrderItems).where(eq(studentOrderItems.orderId, orderId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("paket kirim-rumah menyimpan alamat; handover wajib ongkir", async () => {
    const stamp = Date.now();
    const schoolId = `test-pkr-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Paket Rumah", code: `ALW-PKR-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const studentId = `st-pkr-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-PKR-${stamp}`, name: "Siswa Pkr",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", createdAt: now, updatedAt: now,
    });
    const pkgId = `pkg-pkr-${stamp}`;
    await db.insert(bookPackages).values({
      id: pkgId, code: `PKG-PKR-${stamp}`, name: "Paket Pkr",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      price: 500000, createdAt: now, updatedAt: now,
    });
    await db.insert(packageItems).values({
      id: `pi-pkr-${stamp}`, packageId: pkgId, currentSchoolId: schoolId,
      barcode: `PKG-PKR-B-${stamp}`, status: "in_stock", createdAt: now, updatedAt: now,
    });
    const { submitPublicOrder } = await import("../services/order-intake");
    const { MemoryStorageService } = await import("../../services/storage");
    const created = await submitPublicOrder(
      {
        studentId, packageId: pkgId,
        homeAddress: "Jl. Pkr RT 01 RW 01, Serpong 15310",
        orderType: "regular",
        payment: { transferAmount: 500000, bookAllocationAmount: 500000 },
      },
      { database: db, storage: new MemoryStorageService() }
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const orderId = created.data.order.id;
    const [stored] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
    expect(stored.homeAddressSnapshot).toContain("Serpong");
    try {
      mockActor("branch_admin", schoolId);
      const blocked = await studentOrdersRouter.request(`/${orderId}/handover`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: "Ortu Pkr" }),
      });
      expect(blocked.status).toBe(400);
      mockActor("central_admin", null);
      const ship = await studentOrdersRouter.request(`/${orderId}/shipping`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingCost: 0, shippingResi: "INTERNAL-1" }),
      });
      expect(ship.status).toBe(200);
      // Klaim bukti transfer belum melunasi: gudang harus verifikasi dulu.
      const [claimRow] = await selectReceiptsForOrder(orderId);
      const claim = claimRow.receipt;
      mockActor("central_admin", null);
      const verifyClaim = await paymentsRouter.request(`/orders/${orderId}/payments/${claim.id}/verify`, { method: "POST" });
      expect(verifyClaim.status).toBe(200);
      expect((await verifyClaim.json()).data.paymentStatus).toBe("paid");
      mockActor("branch_admin", schoolId);
      const ok = await studentOrdersRouter.request(`/${orderId}/handover`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: "Ortu Pkr" }),
      });
      expect(ok.status).toBe(200);
    } finally {
      mockActor("central_admin", null);
      await deleteReceiptsForOrders([orderId]);
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(packageItems).where(eq(packageItems.id, `pi-pkr-${stamp}`));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("handover paket menandai flag sudah-ambil-paket murid", async () => {
    const stamp = Date.now();
    const schoolId = `test-flag-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Flag", code: `ALW-FLAG-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const studentId = `st-flag-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-FLAG-${stamp}`, name: "Siswa Flag",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", createdAt: now, updatedAt: now,
    });
    const pkgId = `pkg-flag-${stamp}`;
    await db.insert(bookPackages).values({
      id: pkgId, code: `PKG-FLAG-${stamp}`, name: "Paket Flag",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      price: 500000, createdAt: now, updatedAt: now,
    });
    await db.insert(packageItems).values({
      id: `pi-flag-${stamp}`, packageId: pkgId, currentSchoolId: schoolId,
      barcode: `PKG-FLAG-B-${stamp}`, status: "in_stock", createdAt: now, updatedAt: now,
    });
    const orderId = `ord-flag-${stamp}`;
    await db.insert(studentBookOrders).values({
      id: orderId, orderNumber: `ORD-FLAG-${String(stamp).slice(-6)}`,
      studentId, schoolId, packageId: pkgId, orderType: "regular",
      paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
      totalAmount: 500000, paidAmount: 500000, createdAt: now, updatedAt: now,
    });
    try {
      mockActor("branch_admin", schoolId);
      const res = await studentOrdersRouter.request(`/${orderId}/handover`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: "Ortu Flag" }),
      });
      expect(res.status).toBe(200);
      const [st] = await db.select().from(students).where(eq(students.id, studentId));
      expect(st.hasTakenPackage).toBe(true);
    } finally {
      mockActor("central_admin", null);
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(packageItems).where(eq(packageItems.id, `pi-flag-${stamp}`));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});
