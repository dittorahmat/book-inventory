import { describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { publicOrdersRouter } from "./public-orders";
import { submitPublicOrder } from "../services/public-order";
import { MemoryStorageService } from "../../services/storage";
import { db } from "../../db";
import {
  bookItems,
  books,
  bookPackages,
  orderPayments,
  schools,
  studentBookOrders,
  studentOrderItems,
  students,
} from "../../db/schema";

describe("Public Orders & Student Search API", () => {
  it("searches student with promotion detection and submits order with payment or scholarship", async () => {
    const schoolId = `test-po-school-${Date.now()}`;
    const now = new Date().toISOString();

    // 1. Setup school
    await db.insert(schools).values({
      id: schoolId,
      name: "Al Wildan Test",
      code: `ALW-PO-${Date.now()}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    // 2. Setup students (one promoted old student, one regular)
    const hendraId = `st-hendra-${Date.now()}`;
    await db.insert(students).values({
      id: hendraId,
      schoolId,
      nis: "20241001",
      name: "Hendra Wahyudi",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2025/2026",
      status: "promoted", // Naik kelas to 2
      parentName: "Wahyudi",
      parentEmail: "wahyudi@example.com",
      parentPhone: "+62812345678",
      createdAt: now,
      updatedAt: now,
    });

    // 3. Setup package for grade 2
    const pkgId = `pkg-sd2-${Date.now()}`;
    await db.insert(bookPackages).values({
      id: pkgId,
      code: `PKG-SD2-INT-${Date.now()}`,
      name: "Paket Kelas 2 SD Internasional",
      gradeLevel: "2",
      curriculumType: "international",
      academicYear: "2026/2027",
      price: 1500000,
      createdAt: now,
      updatedAt: now,
    });

    // 4. Test Search by partial name "hendra" with specific schoolId
    const searchRes = await publicOrdersRouter.request(`/search-students?query=hendra&schoolId=${schoolId}`, {
      method: "GET",
    });
    expect(searchRes.status).toBe(200);
    const searchJson = await searchRes.json();
    expect(searchJson.data.length).toBeGreaterThan(0);
    const foundHendra = searchJson.data.find((s: any) => s.id === hendraId);
    expect(foundHendra.name).toBe("Hendra Wahyudi");
    expect(foundHendra.detectedStatus).toBe("naik_kelas");
    expect(foundHendra.targetGradeLevel).toBe("2");

    // 5. Submit regular partial order (Transfer total 5.000.000, book allocation 800.000)
    const orderRes = await publicOrdersRouter.request("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: hendraId,
        packageId: pkgId,
        orderType: "regular",
        payment: {
          transferAmount: 5000000,
          bookAllocationAmount: 800000,
          bankName: "BCA",
          referenceNumber: "TRX-BCA-9921",
        },
      }),
    });
    expect(orderRes.status).toBe(201);
    const orderJson = await orderRes.json();
    expect(orderJson.data.totalAmount).toBe(1500000);
    expect(orderJson.data.paidAmount).toBe(800000);
    expect(orderJson.data.paymentStatus).toBe("partial");

    // 6. Test Scholarship Order submission (100% discount, requires proof)
    const beasiswaStudentId = `st-beasiswa-${Date.now()}`;
    await db.insert(students).values({
      id: beasiswaStudentId,
      schoolId,
      nis: "20241002",
      name: "Ahmad Beasiswa",
      gradeLevel: "2",
      curriculumType: "international",
      academicYear: "2026/2027",
      status: "active",
      parentName: "Siti",
      parentEmail: "siti@example.com",
      parentPhone: "+62812345679",
      createdAt: now,
      updatedAt: now,
    });

    const schRes = await publicOrdersRouter.request("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: beasiswaStudentId,
        packageId: pkgId,
        orderType: "scholarship",
        scholarshipProofBase64: "data:image/jpeg;base64,dGVzdC1iZWFzaXN3YQ==",
      }),
    });
    expect(schRes.status).toBe(201);
    const schJson = await schRes.json();
    expect(schJson.data.totalAmount).toBe(0); // 100% discount
    expect(schJson.data.paymentStatus).toBe("scholarship_pending");

    // 7. Test Public Order Lookup by NIS or OrderNumber
    const lookupRes = await publicOrdersRouter.request(`/lookup-order?query=${encodeURIComponent("20241001")}`, {
      method: "GET",
    });
    expect(lookupRes.status).toBe(200);
    const lookupJson = await lookupRes.json();
    expect(lookupJson.data.length).toBeGreaterThan(0);
    expect(lookupJson.data[0].studentName).toBe("Hendra Wahyudi");

    // 8. Test Public Return Submission for Defective Book (T3: report requires picked_up)
    await db
      .update(studentBookOrders)
      .set({ fulfillmentStatus: "picked_up", updatedAt: now })
      .where(eq(studentBookOrders.id, orderJson.data.order.id));
    const returnSubmitRes = await publicOrdersRouter.request("/submit-return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: orderJson.data.order.id,
        studentId: hendraId,
        defectiveBookId: "b-math-1",
        reason: "Halaman 15 sampai 22 sobek dan tidak tercetak",
        photoProofBase64: "data:image/jpeg;base64,dGVzdC1mb3RvLXJ1c2Fr",
      }),
    });
    expect(returnSubmitRes.status).toBe(201);
    const returnJson = await returnSubmitRes.json();
    expect(returnJson.success).toBe(true);
    expect(returnJson.data.status).toBe("reported");
  });

  it("search exposes grade+curriculum for locked package matching with seeded string IDs", async () => {
    const stamp = Date.now();
    // Custom seeded string IDs (slug style, NOT uuid) must be accepted everywhere
    const schoolId = `school-lock-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Al Wildan Lock Test",
      code: `ALW-LOCK-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const promotedNasId = `std-lock-bimo-${stamp}`;
    await db.insert(students).values({
      id: promotedNasId,
      schoolId,
      nis: `LOCK${String(stamp).slice(-6)}`,
      name: `Bimo Lock ${stamp}`,
      gradeLevel: "1",
      curriculumType: "national",
      academicYear: "2025/2026",
      status: "promoted", // Naik ke Kelas 2 Nasional -> kunci paket NAS
      parentName: "Ortu Bimo",
      parentEmail: "bimo.lock@example.com",
      parentPhone: "+628100000001",
      createdAt: now,
      updatedAt: now,
    });

    const searchRes = await publicOrdersRouter.request(
      `/search-students?query=${encodeURIComponent(`Bimo Lock ${stamp}`)}&schoolId=${schoolId}`,
      { method: "GET" }
    );
    expect(searchRes.status).toBe(200);
    const searchJson = await searchRes.json();
    const found = searchJson.data.find((s: any) => s.id === promotedNasId);
    expect(found).toBeDefined();
    // Fields required by the locked-package UI
    expect(found.gradeLevel).toBe("1");
    expect(found.curriculumType).toBe("national");
    expect(found.currentGradeLevel).toBe("1");
    expect(found.targetGradeLevel).toBe("2");
    expect(found.detectedStatus).toBe("naik_kelas");
  });

  it("empty-state precondition: promoted student may target a grade with no package", async () => {
    const stamp = Date.now();
    const schoolId = `school-empty-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Al Wildan Empty Test",
      code: `ALW-EMPTY-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const rakaId = `std-lock-raka-${stamp}`;
    await db.insert(students).values({
      id: rakaId,
      schoolId,
      nis: `EMPTY${String(stamp).slice(-6)}`,
      name: `Raka Empty ${stamp}`,
      gradeLevel: "98",
      curriculumType: "international",
      academicYear: "2025/2026",
      status: "promoted", // Target Kelas 99 -> tidak ada paket
      parentName: "Ortu Raka",
      parentEmail: "raka.empty@example.com",
      parentPhone: "+628100000002",
      createdAt: now,
      updatedAt: now,
    });

    const searchRes = await publicOrdersRouter.request(
      `/search-students?query=${encodeURIComponent(`Raka Empty ${stamp}`)}&schoolId=${schoolId}`,
      { method: "GET" }
    );
    expect(searchRes.status).toBe(200);
    const searchJson = await searchRes.json();
    const found = searchJson.data.find((s: any) => s.id === rakaId);
    expect(found?.targetGradeLevel).toBe("99");

    const pkgs = await db
      .select()
      .from(bookPackages)
      .where(eq(bookPackages.gradeLevel, "99"));
    expect(pkgs.length).toBe(0);
  });

  it("rejects scholarship submit without proof and accepts it with proof", async () => {
    const stamp = Date.now();
    const schoolId = `school-sch-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Al Wildan Scholarship Test",
      code: `ALW-SCH-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const studentId = `std-sch-${stamp}`;
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: `SCH${String(stamp).slice(-6)}`,
      name: `Siswa Beasiswa ${stamp}`,
      gradeLevel: "2",
      curriculumType: "international",
      academicYear: "2026/2027",
      status: "active",
      parentName: "Ortu Beasiswa",
      parentEmail: "beasiswa@example.com",
      parentPhone: "+628100000003",
      createdAt: now,
      updatedAt: now,
    });

    const pkgId = `pkg-sch-${stamp}`;
    await db.insert(bookPackages).values({
      id: pkgId,
      code: `PKG-SCH-${stamp}`,
      name: "Paket Kelas 2 SD Internasional",
      gradeLevel: "2",
      curriculumType: "international",
      academicYear: "2026/2027",
      price: 1950000,
      createdAt: now,
      updatedAt: now,
    });

    // Without proof -> 400 JSON, no order created
    const rejected = await publicOrdersRouter.request("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, packageId: pkgId, orderType: "scholarship" }),
    });
    expect(rejected.status).toBe(400);
    const rejectedJson = await rejected.json();
    expect(rejectedJson.success).toBe(false);
    expect(rejectedJson.message).toContain("beasiswa");

    // With proof -> 201, totalAmount 0, scholarship_pending
    const accepted = await publicOrdersRouter.request("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        packageId: pkgId,
        orderType: "scholarship",
        scholarshipProofBase64: "data:image/jpeg;base64,dGVzdC1iZWFzaXN3YS1kb2t1bWVu",
      }),
    });
    expect(accepted.status).toBe(201);
    const acceptedJson = await accepted.json();
    expect(acceptedJson.data.totalAmount).toBe(0);
    expect(acceptedJson.data.paymentStatus).toBe("scholarship_pending");
  });

  it("locks unverified students out of search and submit", async () => {
    const stamp = Date.now();
    const schoolId = `school-verify-${stamp}`;
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Al Wildan Verify Test",
      code: `ALW-VERIFY-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const pkgId = `pkg-verify-${stamp}`;
    await db.insert(bookPackages).values({
      id: pkgId,
      code: `PKG-VERIFY-${stamp}`,
      name: "Paket Kelas 1 SD Internasional",
      gradeLevel: "1",
      curriculumType: "international",
      academicYear: "2026/2027",
      price: 1800000,
      createdAt: now,
      updatedAt: now,
    });

    // Register via public form -> new_pending
    const regRes = await publicOrdersRouter.request("/register-student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId,
        name: `Pending Kid ${stamp}`,
        gender: "male",
        gradeLevel: "1",
        curriculumType: "international",
        academicYear: "2026/2027",
        parentName: "Ortu Pending",
        parentEmail: "pending@example.com",
        parentPhone: "+628100000004",
      }),
    });
    expect(regRes.status).toBe(201);
    const regJson = await regRes.json();
    expect(regJson.data.status).toBe("new_pending");
    const pendingId: string = regJson.data.id;

    // Hidden from portal search
    const searchRes = await publicOrdersRouter.request(
      `/search-students?query=${encodeURIComponent(`Pending Kid ${stamp}`)}&schoolId=${schoolId}`,
      { method: "GET" }
    );
    expect(searchRes.status).toBe(200);
    const searchJson = await searchRes.json();
    expect(searchJson.data.find((s: any) => s.id === pendingId)).toBeUndefined();

    // Forced submit -> 403, no order created
    const submitRes = await publicOrdersRouter.request("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: pendingId, packageId: pkgId, orderType: "regular" }),
    });
    expect(submitRes.status).toBe(403);
    const submitJson = await submitRes.json();
    expect(submitJson.success).toBe(false);
    expect(submitJson.message).toContain("verifikasi");
  });

  it("rejects public return submission for unknown orders (shared intake)", async () => {
    const stamp = Date.now();
    const res = await publicOrdersRouter.request("/submit-return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: `ord-ghost-pub-${stamp}`,
        studentId: `st-ghost-pub-${stamp}`,
        defectiveBookId: `b-ghost-pub-${stamp}`,
        reason: "Halaman 15 sampai 22 sobek dan tidak tercetak",
        photoProofBase64: "data:image/jpeg;base64,dGVzdC1mb3RvLXJ1c2Fr",
      }),
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { success: boolean }).success).toBe(false);
  });
});

class TrackingStorage extends MemoryStorageService {
  uploads: string[] = [];
  deletes: string[] = [];
  override async upload(
    key: string,
    file: Uint8Array | ArrayBuffer | Buffer,
    contentType: string
  ): Promise<string> {
    this.uploads.push(key);
    return super.upload(key, file, contentType);
  }
  override async delete(key: string): Promise<void> {
    this.deletes.push(key);
    return super.delete(key);
  }
}

const openSatuan = () => async () => ({
  academicYear: "2026/2027",
  open: true,
  todayWIB: "2026-10-09",
  openFrom: "2026-01-01",
  override: null,
  reason: "Dibuka untuk test.",
});

describe("T6 public intake seam (injected db+storage, reserve-before-upload, orphan compensation)", () => {
  it("writes loose order via injected adapters with deterministic ids and batch", async () => {
    const stamp = Date.now();
    const schoolId = `school-t6-${stamp}`;
    const studentId = crypto.randomUUID();
    const bookId = `book-t6-${stamp}`;
    const orderId = `ord-t6-${stamp}`;
    const orderNo = `ORD-T6-${stamp}`;
    const now = new Date().toISOString();
    const storage = new TrackingStorage();

    await db.insert(schools).values({
      id: schoolId,
      name: `T6 School ${stamp}`,
      code: `T6-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: `T6${String(stamp).slice(-6)}`,
      name: `T6 Kid ${stamp}`,
      gradeLevel: "2",
      curriculumType: "international",
      academicYear: "2026/2027",
      status: "active",
      parentName: "Ortu T6",
      parentEmail: "t6@example.com",
      parentPhone: "+628100000006",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-T6-${stamp}`,
      title: `T6 Book ${stamp}`,
      author: "Pengarang",
      publisher: "Penerbit",
      price: 50000,
      sellPrice: 60000,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(bookItems).values([
      {
        id: `bi-t6-a-${stamp}`,
        bookId,
        currentSchoolId: schoolId,
        barcode: `T6-A-${stamp}`,
        condition: "new",
        status: "in_stock",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `bi-t6-b-${stamp}`,
        bookId,
        currentSchoolId: schoolId,
        barcode: `T6-B-${stamp}`,
        condition: "good",
        status: "in_stock",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    try {
      let itemSeq = 0;
      const result = await submitPublicOrder(
        {
          studentId,
          looseItems: [{ bookId, quantity: 2 }],
          orderType: "regular",
          payment: {
            transferAmount: 200000,
            bookAllocationAmount: 120000,
            bankName: "BCA",
            paymentProofBase64: "data:image/jpeg;base64,dGVzdC1wcm9vZg==",
          },
        },
        {
          database: db,
          storage,
          now: () => now,
          generateId: () => orderId,
          generateOrderNumber: () => orderNo,
          generateItemId: () => `oi-t6-${stamp}-${++itemSeq}`,
          generatePaymentId: () => `pay-t6-${stamp}`,
          getSatuanStatus: openSatuan(),
        }
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.order.id).toBe(orderId);
      expect(result.data.order.orderNumber).toBe(orderNo);
      expect(result.data.totalAmount).toBe(120000);
      expect(result.data.paidAmount).toBe(120000);
      expect(result.data.paymentStatus).toBe("paid");

      const items = await db
        .select()
        .from(studentOrderItems)
        .where(eq(studentOrderItems.orderId, orderId));
      expect(items).toHaveLength(1);
      expect(items[0].unitPriceSnapshot).toBe(60000);

      const payments = await db
        .select()
        .from(orderPayments)
        .where(eq(orderPayments.orderId, orderId));
      expect(payments).toHaveLength(1);
      expect(payments[0].paymentProofUrl).toContain("/api/media/payments/");

      const proof = payments[0].paymentProofUrl ?? "";
      const proofKey = proof.replace("/api/media/", "");
      expect(await storage.getFile(proofKey)).not.toBeNull();
    } finally {
      await db.delete(orderPayments).where(eq(orderPayments.orderId, orderId));
      await db.delete(studentOrderItems).where(eq(studentOrderItems.orderId, orderId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(bookItems).where(inArray(bookItems.id, [`bi-t6-a-${stamp}`, `bi-t6-b-${stamp}`]));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("reserves stock before upload: insufficient quantity returns 400 with zero uploads", async () => {
    const stamp = Date.now();
    const schoolId = `school-t6-short-${stamp}`;
    const studentId = `std-t6-short-${stamp}`;
    const bookId = `book-t6-short-${stamp}`;
    const now = new Date().toISOString();
    const storage = new TrackingStorage();

    await db.insert(schools).values({
      id: schoolId,
      name: `T6 Short School ${stamp}`,
      code: `T6-SHORT-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: `T6S${String(stamp).slice(-6)}`,
      name: `T6 Short Kid ${stamp}`,
      gradeLevel: "2",
      curriculumType: "international",
      academicYear: "2026/2027",
      status: "active",
      parentName: "Ortu T6",
      parentEmail: "t6short@example.com",
      parentPhone: "+628100000007",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(books).values({
      id: bookId,
      isbn: `ISBN-T6-SHORT-${stamp}`,
      title: `T6 Short Book ${stamp}`,
      author: "Pengarang",
      publisher: "Penerbit",
      price: 40000,
      sellPrice: 45000,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(bookItems).values({
      id: `bi-t6-short-${stamp}`,
      bookId,
      currentSchoolId: schoolId,
      barcode: `T6-SHORT-${stamp}`,
      condition: "new",
      status: "in_stock",
      createdAt: now,
      updatedAt: now,
    });

    try {
      const result = await submitPublicOrder(
        {
          studentId,
          looseItems: [{ bookId, quantity: 5 }],
          orderType: "regular",
          payment: {
            transferAmount: 500000,
            bookAllocationAmount: 225000,
            paymentProofBase64: "data:image/jpeg;base64,dGVzdC1wcm9vZg==",
          },
        },
        {
          database: db,
          storage,
          now: () => now,
          generateId: () => `ord-t6-short-${stamp}`,
          generateOrderNumber: () => `ORD-T6-SHORT-${stamp}`,
          getSatuanStatus: openSatuan(),
        }
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(400);
      expect(result.message).toContain("Stok tidak cukup");
      expect(storage.uploads).toHaveLength(0);

      const leaked = await db
        .select()
        .from(studentBookOrders)
        .where(eq(studentBookOrders.id, `ord-t6-short-${stamp}`));
      expect(leaked).toHaveLength(0);
    } finally {
      await db.delete(bookItems).where(eq(bookItems.id, `bi-t6-short-${stamp}`));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("compensates orphans: duplicate order number maps D1 error to 400 with no leftover objects", async () => {
    const stamp = Date.now();
    const schoolId = `school-t6-orphan-${stamp}`;
    const studentId = `std-t6-orphan-${stamp}`;
    const pkgId = `pkg-t6-orphan-${stamp}`;
    const firstOrderId = `ord-t6-orphan-1-${stamp}`;
    const secondOrderId = `ord-t6-orphan-2-${stamp}`;
    const dupOrderNo = `ORD-T6-DUP-${stamp}`;
    const now = new Date().toISOString();
    const storage = new TrackingStorage();

    await db.insert(schools).values({
      id: schoolId,
      name: `T6 Orphan School ${stamp}`,
      code: `T6-ORPHAN-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: `T6O${String(stamp).slice(-6)}`,
      name: `T6 Orphan Kid ${stamp}`,
      gradeLevel: "2",
      curriculumType: "international",
      academicYear: "2026/2027",
      status: "active",
      parentName: "Ortu T6",
      parentEmail: "t6orphan@example.com",
      parentPhone: "+628100000008",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(bookPackages).values({
      id: pkgId,
      code: `PKG-T6-ORPHAN-${stamp}`,
      name: `Paket T6 Orphan ${stamp}`,
      gradeLevel: "2",
      curriculumType: "international",
      academicYear: "2026/2027",
      price: 1500000,
      createdAt: now,
      updatedAt: now,
    });

    try {
      const first = await submitPublicOrder(
        {
          studentId,
          packageId: pkgId,
          orderType: "scholarship",
          scholarshipProofBase64: "data:image/jpeg;base64,cHJvb2YtcGVydGFtYQ==",
        },
        {
          database: db,
          storage,
          now: () => now,
          generateId: () => firstOrderId,
          generateOrderNumber: () => dupOrderNo,
        }
      );
      expect(first.ok).toBe(true);
      const uploadsAfterFirst = storage.uploads.length;
      expect(uploadsAfterFirst).toBe(1);

      const second = await submitPublicOrder(
        {
          studentId,
          packageId: pkgId,
          orderType: "scholarship",
          scholarshipProofBase64: "data:image/jpeg;base64,cHJvb2Yta2VkdWE=",
        },
        {
          database: db,
          storage,
          now: () => now,
          generateId: () => secondOrderId,
          generateOrderNumber: () => dupOrderNo,
        }
      );

      expect(second.ok).toBe(false);
      if (second.ok) return;
      expect(second.status).toBe(400);
      expect(second.message.length).toBeGreaterThan(0);

      expect(storage.deletes.length).toBeGreaterThanOrEqual(1);
      for (const key of storage.deletes) {
        expect(await storage.getFile(key)).toBeNull();
      }
      const surviving = await db
        .select()
        .from(studentBookOrders)
        .where(eq(studentBookOrders.orderNumber, dupOrderNo));
      expect(surviving).toHaveLength(1);
      expect(surviving[0].id).toBe(firstOrderId);
    } finally {
      await db
        .delete(studentBookOrders)
        .where(inArray(studentBookOrders.id, [firstOrderId, secondOrderId]));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("writes 30 loose lines in one chunked batch without N+1 failure", async () => {
    const stamp = Date.now();
    const schoolId = `school-t6-vol-${stamp}`;
    const studentId = `std-t6-vol-${stamp}`;
    const orderId = `ord-t6-vol-${stamp}`;
    const now = new Date().toISOString();
    const storage = new TrackingStorage();
    const bookIds: string[] = Array.from({ length: 30 }, (_, i) => `book-t6-vol-${stamp}-${i}`);
    const itemIds: string[] = Array.from({ length: 30 }, (_, i) => `bi-t6-vol-${stamp}-${i}`);

    await db.insert(schools).values({
      id: schoolId,
      name: `T6 Volume School ${stamp}`,
      code: `T6-VOL-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(students).values({
      id: studentId,
      schoolId,
      nis: `T6V${String(stamp).slice(-6)}`,
      name: `T6 Volume Kid ${stamp}`,
      gradeLevel: "2",
      curriculumType: "international",
      academicYear: "2026/2027",
      status: "active",
      parentName: "Ortu T6",
      parentEmail: "t6vol@example.com",
      parentPhone: "+628100000009",
      createdAt: now,
      updatedAt: now,
    });
    for (const [i, bookId] of bookIds.entries()) {
      await db.insert(books).values({
        id: bookId,
        isbn: `ISBN-T6-VOL-${stamp}-${i}`,
        title: `T6 Volume Book ${stamp}-${i}`,
        author: "Pengarang",
        publisher: "Penerbit",
        price: 10000,
        sellPrice: 10000,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(bookItems).values({
        id: itemIds[i],
        bookId,
        currentSchoolId: schoolId,
        barcode: `T6-VOL-${stamp}-${i}`,
        condition: "new",
        status: "in_stock",
        createdAt: now,
        updatedAt: now,
      });
    }

    try {
      let itemSeq = 0;
      const result = await submitPublicOrder(
        {
          studentId,
          looseItems: bookIds.map((bookId) => ({ bookId, quantity: 1 })),
          orderType: "regular",
        },
        {
          database: db,
          storage,
          now: () => now,
          generateId: () => orderId,
          generateOrderNumber: () => `ORD-T6-VOL-${stamp}`,
          generateItemId: () => `oi-t6-vol-${stamp}-${++itemSeq}`,
          getSatuanStatus: openSatuan(),
        }
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.totalAmount).toBe(300000);

      const items = await db
        .select()
        .from(studentOrderItems)
        .where(eq(studentOrderItems.orderId, orderId));
      expect(items).toHaveLength(30);
    } finally {
      await db.delete(studentOrderItems).where(eq(studentOrderItems.orderId, orderId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await db.delete(bookItems).where(inArray(bookItems.id, itemIds));
      await db.delete(books).where(inArray(books.id, bookIds));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});

describe("Portal search partition (§11 anti full-scan)", () => {
  it("rejects search-students without schoolId and finds nickname within partition", async () => {
    const stamp = Date.now();
    const schoolA = `school-pp-${stamp}`;
    const schoolB = `school-pq-${stamp}`;
    const now = new Date().toISOString();
    for (const [id, code] of [[schoolA, `ALW-PP-${stamp}`], [schoolB, `ALW-PQ-${stamp}`]]) {
      await db.insert(schools).values({ id, name: `Sekolah ${id}`, code, type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();
    }
    try {
      await db.insert(students).values({
        id: `st-ppann-${stamp}`,
        schoolId: schoolA,
        nis: `PPA${stamp}`,
        name: `Annisa Salsabila ${stamp}`,
        gradeLevel: "1",
        curriculumType: "international",
        academicYear: "2026/2027",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(students).values({
        id: `st-pplain-${stamp}`,
        schoolId: schoolB,
        nis: `PPL${stamp}`,
        name: `Salsa Lain ${stamp}`,
        gradeLevel: "1",
        curriculumType: "international",
        academicYear: "2026/2027",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const noSchool = await publicOrdersRouter.request(`/search-students?query=salsa`);
      expect(noSchool.status).toBe(400);

      const res = await publicOrdersRouter.request(`/search-students?query=salsa&schoolId=${schoolA}`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.some((s: any) => s.id === `st-ppann-${stamp}`)).toBe(true);
      expect(json.data.every((s: any) => s.schoolId === schoolA)).toBe(true);
      expect(json.data.length).toBeLessThanOrEqual(10);
    } finally {
      await db.delete(students).where(inArray(students.id, [`st-ppann-${stamp}`, `st-pplain-${stamp}`]));
      await db.delete(schools).where(inArray(schools.id, [schoolA, schoolB]));
    }
  });

  it("partitions lookup-order by optional schoolId", async () => {
    const stamp = Date.now();
    const schoolA = `school-pl-${stamp}`;
    const schoolB = `school-pm-${stamp}`;
    const now = new Date().toISOString();
    for (const [id, code] of [[schoolA, `ALW-PL-${stamp}`], [schoolB, `ALW-PM-${stamp}`]]) {
      await db.insert(schools).values({ id, name: `Sekolah ${id}`, code, type: "branch", createdAt: now, updatedAt: now }).onConflictDoNothing();
    }
    const orderNumber = `ORD-PL-${String(stamp).slice(-6)}`;
    try {
      await db.insert(students).values({
        id: `st-pl-${stamp}`,
        schoolId: schoolA,
        nis: `PLN${stamp}`,
        name: `Lookup Anak ${stamp}`,
        gradeLevel: "3",
        curriculumType: "national",
        academicYear: "2026/2027",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: `ord-pl-${stamp}`,
        orderNumber,
        studentId: `st-pl-${stamp}`,
        schoolId: schoolA,
        orderType: "regular",
        paymentStatus: "unpaid",
        fulfillmentStatus: "waiting_preparation",
        totalAmount: 100000,
        paidAmount: 0,
        createdAt: now,
        updatedAt: now,
      });

      const found = await publicOrdersRouter.request(`/lookup-order?query=${encodeURIComponent(orderNumber)}&schoolId=${schoolA}`);
      const foundJson = await found.json();
      expect(found.status).toBe(200);
      expect(foundJson.data.some((o: any) => o.orderNumber === orderNumber)).toBe(true);

      const wrongSchool = await publicOrdersRouter.request(`/lookup-order?query=${encodeURIComponent(orderNumber)}&schoolId=${schoolB}`);
      expect(wrongSchool.status).toBe(404);
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, `ord-pl-${stamp}`));
      await db.delete(students).where(eq(students.id, `st-pl-${stamp}`));
      await db.delete(schools).where(inArray(schools.id, [schoolA, schoolB]));
    }
  });
});
