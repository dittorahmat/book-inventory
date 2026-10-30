import { describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { publicOrdersRouter } from "./public-orders";
import { submitPublicOrder } from "../services/order-intake";
import { MemoryStorageService, defaultStorage, setStorageService } from "../../services/storage";
import { db } from "../../db";
import {
  bookItems,
  bookPackageItems,
  bookPackages,
  bookReturns,
  books,
  schools,
  studentBookOrders,
  studentOrderItems,
  students,
} from "../../db/schema";
import { deleteReceiptsForOrders, selectReceiptsForOrder } from "./test-payments";

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
          paymentProofBase64: "data:image/jpeg;base64,dGVzdC1oZW5kcmEtcHJvb2Y=",
        },
      }),
    });
    expect(orderRes.status).toBe(201);
    const orderJson = await orderRes.json();
    expect(orderJson.data.totalAmount).toBe(1500000);
    // ADR-0018: Alokasi 800.000 dari 1.500.000 dicatat sebagai partial (cicilan)
    expect(orderJson.data.paidAmount).toBe(800000);
    expect(orderJson.data.paymentStatus).toBe("partial");
    // Notifikasi dilaporkan ke pemanggil, tidak fire-and-forget (simulasi di test).
    expect(orderJson.data.notification).toBeDefined();
    expect(orderJson.data.notification.success).toBe(true);

    // Rule 21 & ADR-0018: Submit dengan allocationAmount kanonik langsung lunas saat nominal penuh
    const lunasRes = await publicOrdersRouter.request("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: hendraId,
        packageId: pkgId,
        orderType: "regular",
        payment: {
          transferAmount: 1500000,
          allocationAmount: 1500000,
          bankName: "Mandiri",
          referenceNumber: `TRX-MDR-${Date.now()}`,
          paymentProofBase64: "data:image/jpeg;base64,dGVzdC1sdW5hcy1wcm9vZg==",
        },
      }),
    });
    expect(lunasRes.status).toBe(201);
    const lunasJson = await lunasRes.json();
    expect(lunasJson.data.totalAmount).toBe(1500000);
    expect(lunasJson.data.paidAmount).toBe(1500000);
    expect(lunasJson.data.paymentStatus).toBe("paid");

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
    // ADR-0018: Beasiswa dengan dokumen langsung disetujui
    expect(schJson.data.paymentStatus).toBe("scholarship_approved");

    // 7. Test Public Order Lookup by NIS or OrderNumber (partitioned by schoolId)
    const lookupRes = await publicOrdersRouter.request(`/lookup-order?query=${encodeURIComponent("20241001")}&schoolId=${schoolId}`, {
      method: "GET",
    });
    expect(lookupRes.status).toBe(200);
    const lookupJson = await lookupRes.json();
    expect(lookupJson.data.length).toBeGreaterThan(0);
    expect(lookupJson.data[0].studentName).toBe("Hendra Wahyudi");
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

  it("rejects regular submit without payment proof and accepts it with proof", async () => {
    const stamp = Date.now();
    const schoolId = `school-regproof-${stamp}`;
    const studentId = `st-regproof-${stamp}`;
    const pkgId = `pkg-regproof-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({ id: schoolId, name: "Reg Proof School", code: `RPS-${stamp}`, type: "branch", createdAt: now, updatedAt: now });
    await db.insert(bookPackages).values({ id: pkgId, code: `PKG-RP-${stamp}`, name: "Paket Reg Proof", academicYear: "2026/2027", gradeLevel: "1", curriculumType: "international", price: 500000, createdAt: now, updatedAt: now });
    await db.insert(students).values({ id: studentId, schoolId, nis: `RP-${stamp}`, name: "Anak Reg Proof", gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027", status: "active", createdAt: now, updatedAt: now });

    const rejected = await publicOrdersRouter.request("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, packageId: pkgId, orderType: "regular" }),
    });
    expect(rejected.status).toBe(400);
    const rejectedJson = await rejected.json();
    expect(rejectedJson.success).toBe(false);
    expect(rejectedJson.message).toContain("Bukti transfer");

    const accepted = await publicOrdersRouter.request("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        packageId: pkgId,
        orderType: "regular",
        payment: {
          transferAmount: 500000,
          bookAllocationAmount: 500000,
          paymentProofBase64: "data:image/jpeg;base64,dGVzdC1yZWdwcm9vZg==",
        },
      }),
    });
    expect(accepted.status).toBe(201);
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
    // ADR-0018: Bukti beasiswa yang valid langsung disetujui (scholarship_approved)
    expect(acceptedJson.data.paymentStatus).toBe("scholarship_approved");
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

  it("register via lifecycle seam sets REG- NIS and promoted view targets next grade", async () => {
    const stamp = Date.now();
    const schoolId = `school-lifecycle-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: schoolId,
      name: "Al Wildan Lifecycle Test",
      code: `ALW-LC-${stamp}`,
      type: "branch",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const regRes = await publicOrdersRouter.request("/register-student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId,
        name: `Lifecycle Kid ${stamp}`,
        gender: "female",
        gradeLevel: "2",
        curriculumType: "national",
        academicYear: "2026/2027",
        parentName: "Ortu Lifecycle",
        parentEmail: "lifecycle@example.com",
        parentPhone: "+628100000009",
      }),
    });
    expect(regRes.status).toBe(201);
    const regJson = await regRes.json();
    expect(regJson.data.status).toBe("new_pending");
    expect(regJson.data.nis.startsWith("REG-")).toBe(true);

    const promotedId = `st-promoted-${stamp}`;
    await db.insert(students).values({
      id: promotedId,
      schoolId,
      nis: `NIS-PROMO-${stamp}`,
      name: `Promoted Kid ${stamp}`,
      gender: "male",
      gradeLevel: "2",
      curriculumType: "national",
      academicYear: "2026/2027",
      parentName: "Ortu Promo",
      parentEmail: "promo@example.com",
      parentPhone: "+628100000010",
      status: "promoted",
      isScholarship: false,
      createdAt: now,
      updatedAt: now,
    });
    const searchRes = await publicOrdersRouter.request(
      `/search-students?query=${encodeURIComponent(`Promoted Kid ${stamp}`)}&schoolId=${schoolId}`,
      { method: "GET" }
    );
    expect(searchRes.status).toBe(200);
    const searchJson = await searchRes.json();
    const found = searchJson.data.find((s: { id: string }) => s.id === promotedId);
    expect(found.detectedStatus).toBe("naik_kelas");
    expect(found.currentGradeLevel).toBe("2");
    expect(found.targetGradeLevel).toBe("3");
    expect(found.canOrder).toBe(true);
    await db.delete(students).where(inArray(students.id, [regJson.data.id, promotedId]));
    await db.delete(schools).where(eq(schools.id, schoolId));
  });

  it("submit-return publik: mencatat refund, menolak pesanan yang tidak layak, dan menyimpan foto bukti", async () => {
    const stamp = () => Date.now() + Math.floor(Math.random() * 10000);
    const now = new Date().toISOString();
    const previousStorage = defaultStorage;
    const storage = new MemoryStorageService();
    setStorageService(storage);
    // PNG 1x1 asli: server memverifikasi magic bytes, bukan content-type klien.
    const PHOTO_PNG =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    interface Seed {
      studentId: string;
      bookId: string;
      otherBookId: string;
      orderId: string;
      orderNumber: string;
      cleanup: () => Promise<void>;
    }

    const seed = async (
      fulfillmentStatus: "picked_up" | "waiting_preparation" | "return_in_progress" = "picked_up"
    ): Promise<Seed> => {
      const s = stamp();
      const schoolId = `test-rf-school-${s}`;
      const studentId = `test-rf-student-${s}`;
      const bookId = `test-rf-book-${s}`;
      const otherBookId = `test-rf-book-other-${s}`;
      const packageId = `test-rf-pkg-${s}`;
      const orderId = `test-rf-order-${s}`;
      const orderNumber = `ORD-RF-${s}`;
      await db.insert(schools).values({
        id: schoolId,
        name: `Sekolah Refund ${s}`,
        code: `RF-${s}`,
        type: "branch",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(students).values({
        id: studentId,
        schoolId,
        nis: `NIS-RF-${s}`,
        name: `Murid Refund ${s}`,
        gender: "male",
        gradeLevel: "4",
        curriculumType: "national",
        academicYear: "2026/2027",
        parentName: "Ortu Refund",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(books).values([
        {
          id: bookId,
          isbn: `ISBN-RF-${s}`,
          title: `Buku Refund ${s}`,
          author: "Penulis",
          publisher: "Penerbit",
          price: 90000,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: otherBookId,
          isbn: `ISBN-RF-OTHER-${s}`,
          title: `Buku Lain ${s}`,
          author: "Penulis",
          publisher: "Penerbit",
          price: 90000,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(bookPackages).values({
        id: packageId,
        code: `PKG-RF-${s}`,
        name: `Paket Refund ${s}`,
        gradeLevel: "4",
        curriculumType: "national",
        academicYear: "2026/2027",
        price: 90000,
        createdAt: now,
        updatedAt: now,
      });
      // Hanya `bookId` yang masuk BOM paket; `otherBookId` ada di katalog tapi bukan isi pesanan.
      await db.insert(bookPackageItems).values({
        id: `test-rf-bom-${s}`,
        packageId,
        bookId,
        quantity: 1,
        createdAt: now,
      });
      await db.insert(studentBookOrders).values({
        id: orderId,
        orderNumber,
        studentId,
        schoolId,
        packageId,
        orderType: "regular",
        paymentStatus: "paid",
        fulfillmentStatus,
        totalAmount: 90000,
        paidAmount: 90000,
        createdAt: now,
        updatedAt: now,
      });
      return {
        studentId,
        bookId,
        otherBookId,
        orderId,
        orderNumber,
        cleanup: async () => {
          await db.delete(bookReturns).where(eq(bookReturns.orderId, orderId));
          await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
          await db.delete(bookPackageItems).where(eq(bookPackageItems.packageId, packageId));
          await db.delete(bookPackages).where(eq(bookPackages.id, packageId));
          await db.delete(books).where(inArray(books.id, [bookId, otherBookId]));
          await db.delete(students).where(eq(students.id, studentId));
          await db.delete(schools).where(eq(schools.id, schoolId));
        },
      };
    };

    const postReturn = (payload: Record<string, unknown>) =>
      publicOrdersRouter.request("/submit-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

    try {
      // 1. Jalur bahagia: tersimpan, pesanan pindah ke return_in_progress, foto publik ber-tipe asli.
      const ok = await seed();
      try {
        const res = await postReturn({
          orderId: ok.orderId,
          studentId: ok.studentId,
          defectiveBookId: ok.bookId,
          reason: "Halaman 15 sampai 22 sobek dan tidak tercetak",
          photoProofBase64: PHOTO_PNG,
        });
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.data.orderNumber).toBe(ok.orderNumber);
        expect(json.data.status).toBe("reported");

        const [row] = await db.select().from(bookReturns).where(eq(bookReturns.id, json.data.returnId));
        expect(row.status).toBe("reported");
        expect(row.photoProofUrl).toContain("/api/media/returns/public_");
        expect(row.photoProofUrl).toContain(".png");
        const proofKey = (row.photoProofUrl ?? "").replace("/api/media/", "");
        expect((await storage.getFile(proofKey))?.contentType).toBe("image/png");

        const [order] = await db
          .select()
          .from(studentBookOrders)
          .where(eq(studentBookOrders.id, ok.orderId));
        expect(order.fulfillmentStatus).toBe("return_in_progress");
      } finally {
        await ok.cleanup();
      }

      // 2. Pesanan milik murid lain ditolak 400.
      const owner = await seed();
      try {
        const res = await postReturn({
          orderId: owner.orderId,
          studentId: `test-rf-other-${stamp()}`,
          defectiveBookId: owner.bookId,
          reason: "Buku salah kirim, ingin dikembalikan",
          photoProofBase64: PHOTO_PNG,
        });
        expect(res.status).toBe(400);
        expect((await res.json()).message).toContain("tidak sesuai");
      } finally {
        await owner.cleanup();
      }

      // 3. Pesanan yang belum diserahkan ditolak 400.
      const pending = await seed("waiting_preparation");
      try {
        const res = await postReturn({
          orderId: pending.orderId,
          studentId: pending.studentId,
          defectiveBookId: pending.bookId,
          reason: "Buku belum diterima tetapi ingin refund",
          photoProofBase64: PHOTO_PNG,
        });
        expect(res.status).toBe(400);
        expect((await res.json()).message).toContain("picked_up");
      } finally {
        await pending.cleanup();
      }

      // 4. Pengajuan ganda: pesanan yang sudah return_in_progress ditolak untuk sumber publik.
      const repeated = await seed("return_in_progress");
      try {
        const res = await postReturn({
          orderId: repeated.orderId,
          studentId: repeated.studentId,
          defectiveBookId: repeated.bookId,
          reason: "Ingin menambah pengajuan kedua",
          photoProofBase64: PHOTO_PNG,
        });
        expect(res.status).toBe(400);
        expect((await res.json()).message).toContain("sudah dikirim");
      } finally {
        await repeated.cleanup();
      }

      // 5. Buku di luar paket pesanan ditolak walau ada di katalog.
      const wrongBook = await seed();
      try {
        const res = await postReturn({
          orderId: wrongBook.orderId,
          studentId: wrongBook.studentId,
          defectiveBookId: wrongBook.otherBookId,
          reason: "Mengembalikan buku yang bukan dari paket ini",
          photoProofBase64: PHOTO_PNG,
        });
        expect(res.status).toBe(400);
        expect((await res.json()).message).toContain("bukan bagian dari paket");
      } finally {
        await wrongBook.cleanup();
      }

      // 6. Foto wajib + harus gambar asli, bukan string base64 sembarang.
      const badPhoto = await seed();
      try {
        const missing = await postReturn({
          orderId: badPhoto.orderId,
          studentId: badPhoto.studentId,
          defectiveBookId: badPhoto.bookId,
          reason: "Halaman robek",
        });
        expect(missing.status).toBe(400);

        const notImage = await postReturn({
          orderId: badPhoto.orderId,
          studentId: badPhoto.studentId,
          defectiveBookId: badPhoto.bookId,
          reason: "Halaman robek",
          photoProofBase64: "data:image/jpeg;base64,dGVzdC1idWthbi1nYW1iYXI=",
        });
        expect(notImage.status).toBe(400);
        expect((await notImage.json()).message).toContain("JPG/PNG/WebP");

        const stored = await db.select().from(bookReturns).where(eq(bookReturns.orderId, badPhoto.orderId));
        expect(stored).toHaveLength(0);
      } finally {
        await badPhoto.cleanup();
      }

      // 7. Pesanan tak dikenal 404.
      const ghost = await postReturn({
        orderId: `test-rf-ghost-${stamp()}`,
        studentId: `test-rf-ghost-student-${stamp()}`,
        defectiveBookId: `test-rf-ghost-book-${stamp()}`,
        reason: "Pesanan tidak ada",
        photoProofBase64: PHOTO_PNG,
      });
      expect(ghost.status).toBe(404);
    } finally {
      setStorageService(previousStorage);
    }
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
          homeAddress: "Jl. Mawar No. 10, RT 02 RW 05, Bogor 16111",
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
      expect(result.data.totalAmount).toBe(120000 + 750000);
      // ADR-0018: Alokasi 120.000 dari total 870.000 dicatat sebagai partial (cicilan)
      expect(result.data.paidAmount).toBe(120000);
      expect(result.data.paymentStatus).toBe("partial");
      expect(result.data.wprCharged).toBe(true);

      const items = await db
        .select()
        .from(studentOrderItems)
        .where(eq(studentOrderItems.orderId, orderId));
      expect(items).toHaveLength(2);
      expect(items[0].unitPriceSnapshot).toBe(60000);

      const payments = await selectReceiptsForOrder(orderId);
      expect(payments).toHaveLength(1);
      expect(payments[0].receipt.proofUrl).toContain("/api/media/payments/");

      const proof = payments[0].receipt.proofUrl ?? "";
      const proofKey = proof.replace("/api/media/", "");
      expect(await storage.getFile(proofKey)).not.toBeNull();
    } finally {
      await deleteReceiptsForOrders([orderId]);
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
          homeAddress: "Jl. Mawar No. 10, RT 02 RW 05, Bogor 16111",
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
          homeAddress: "Jl. Mawar No. 10, RT 02 RW 05, Bogor 16111",
          orderType: "regular",
          payment: {
            transferAmount: 300000 + 750000,
            bookAllocationAmount: 300000 + 750000,
            paymentProofBase64: "data:image/jpeg;base64,dGVzdC12b2x1bWUtcHJvb2Y=",
          },
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
      expect(result.data.totalAmount).toBe(300000 + 750000);
      expect(result.data.wprCharged).toBe(true);

      const items = await db
        .select()
        .from(studentOrderItems)
        .where(eq(studentOrderItems.orderId, orderId));
      expect(items).toHaveLength(31);
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

  it("partitions lookup-order by required schoolId", async () => {
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

      // Mengunci sifat case-insensitive `LIKE` SQLite (bukan bukti bug baru):
      // nomor pesanan berhuruf kecil harus tetap menemukan barisnya.
      const flippedCase = await publicOrdersRouter.request(
        `/lookup-order?query=${encodeURIComponent(orderNumber.toLowerCase())}&schoolId=${schoolA}`
      );
      expect(flippedCase.status).toBe(200);
      const flippedJson = await flippedCase.json();
      expect(flippedJson.data.some((o: { orderNumber: string }) => o.orderNumber === orderNumber)).toBe(true);

      const wrongSchool = await publicOrdersRouter.request(`/lookup-order?query=${encodeURIComponent(orderNumber)}&schoolId=${schoolB}`);
      expect(wrongSchool.status).toBe(404);

      // Tanpa schoolId: ditolak 400 (anti Pindai Penuh, ADR-0002).
      const noSchool = await publicOrdersRouter.request(`/lookup-order?query=${encodeURIComponent(orderNumber)}`);
      expect(noSchool.status).toBe(400);
      expect((await noSchool.json()).message).toMatch(/sekolah/i);
    } finally {
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, `ord-pl-${stamp}`));
      await db.delete(students).where(eq(students.id, `st-pl-${stamp}`));
      await db.delete(schools).where(inArray(schools.id, [schoolA, schoolB]));
    }
  });
});

describe("Portal eligibility seam (T5: canOrder advertised by server)", () => {
  it("advertises canOrder from the shared guard and still enforces at submit", async () => {
    const stamp = Date.now();
    const schoolId = `school-t5-${stamp}`;
    const now = new Date().toISOString();
    await db.insert(schools).values({
      id: schoolId, name: `T5 Sekolah ${stamp}`, code: `T5-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    await db.insert(bookPackages).values({
      id: `pkg-t5-${stamp}`, code: `PKG-T5-${stamp}`, name: "Paket T5",
      gradeLevel: "1", curriculumType: "national", academicYear: "2026/2027",
      price: 50000, createdAt: now, updatedAt: now,
    });
    try {
      await db.insert(students).values([
        {
          id: `st-t5a-${stamp}`, schoolId, nis: `T5A${stamp}`, name: `T5 Aktif ${stamp}`,
          gradeLevel: "1", curriculumType: "national", academicYear: "2026/2027",
          status: "active", createdAt: now, updatedAt: now,
        },
        {
          id: `st-t5g-${stamp}`, schoolId, nis: `T5G${stamp}`, name: `T5 Lulus ${stamp}`,
          gradeLevel: "6", curriculumType: "national", academicYear: "2026/2027",
          status: "graduated", createdAt: now, updatedAt: now,
        },
      ]);
      const search = await publicOrdersRouter.request(
        `/search-students?query=${encodeURIComponent(String(stamp))}&schoolId=${schoolId}`
      );
      expect(search.status).toBe(200);
      const rows = (await search.json()).data;
      const active = rows.find((r: any) => r.id === `st-t5a-${stamp}`);
      const graduated = rows.find((r: any) => r.id === `st-t5g-${stamp}`);
      expect(active.canOrder).toBe(true);
      expect(active.orderBlockedReason).toBeNull();
      expect(graduated.canOrder).toBe(false);
      expect(graduated.orderBlockedReason).toMatch(/verifikasi/);

      const submit = await publicOrdersRouter.request("/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: `st-t5g-${stamp}`, packageId: `pkg-t5-${stamp}`, orderType: "regular" }),
      });
      expect(submit.status).toBe(403);
      expect((await submit.json()).message).toMatch(/verifikasi/);
    } finally {
      await db.delete(students).where(inArray(students.id, [`st-t5a-${stamp}`, `st-t5g-${stamp}`]));
      await db.delete(bookPackages).where(eq(bookPackages.id, `pkg-t5-${stamp}`));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});

describe("Public catalog tanpa login (#143)", () => {
  it("GET /packages terbuka berisi harga + BOM berjudul alias; GET /schools tanpa gudang", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `school-pubcat-${stamp}`;
    const bookId = `book-pubcat-${stamp}`;
    const pkgId = `pkg-pubcat-${stamp}`;
    const { WPR_BOOK_ID, WPR_TITLE } = await import("../../lib/wpr");
    const { ensureWprBook } = await import("../services/wpr");
    await ensureWprBook(db);
    await db.insert(schools).values({
      id: schoolId, name: `Sekolah Publik ${stamp}`, code: `PUB-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    await db.insert(books).values({
      id: bookId, isbn: `ISBN-PUB-${stamp}`, title: `Judul Real ${stamp}`,
      publicTitle: `Judul Ramah ${stamp}`, author: "Pengarang", publisher: "Penerbit",
      price: 50000, sellPrice: 60000, createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    await db.insert(bookPackages).values({
      id: pkgId, code: `PKG-PUB-${stamp}`, name: `Paket Publik ${stamp}`,
      gradeLevel: "1", curriculumType: "national", academicYear: "2026/2027",
      price: 60000, createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const { bookPackageItems } = await import("../../db/schema");
    await db.insert(bookPackageItems).values([
      { id: `bom-pub-${stamp}`, packageId: pkgId, bookId, quantity: 1, createdAt: now },
      { id: `bom-wpr-${stamp}`, packageId: pkgId, bookId: WPR_BOOK_ID, quantity: 1, createdAt: now },
    ]).onConflictDoNothing();
    try {
      const pkgRes = await publicOrdersRouter.request("/packages", { method: "GET" });
      expect(pkgRes.status).toBe(200);
      const pkgJson = await pkgRes.json();
      expect(pkgJson.success).toBe(true);
      interface PublicPkgItem { id: string; bookId: string; title: string; quantity: number; unitPrice?: number }
      interface PublicPkg { id: string; price: number; items: PublicPkgItem[] }
      interface PublicChoice { bookId: string; title: string }
      const found = ((pkgJson.data as unknown[]) as PublicPkg[]).find((p) => p.id === pkgId);
      expect(found).toBeDefined();
      expect(found?.price).toBe(60000);
      expect(found?.items.length).toBe(2);
      expect(found?.items.find((i) => i.bookId === bookId)?.title).toBe(`Judul Ramah ${stamp}`);
      expect(found?.items.find((i) => i.bookId === bookId)?.unitPrice).toBe(60000);
      expect(found?.items.find((i) => i.bookId === WPR_BOOK_ID)?.title).toBe(WPR_TITLE);
      expect(found?.items.find((i) => i.bookId === WPR_BOOK_ID)?.unitPrice).toBe(750000);
      // Anti window-shopping: tanpa ISBN/penulis/penerbit/cover di DTO publik.
      for (const it of found?.items ?? []) {
        expect(it).not.toHaveProperty("isbn");
        expect(it).not.toHaveProperty("author");
        expect(it).not.toHaveProperty("publisher");
        expect(it).not.toHaveProperty("coverUrl");
        expect(it).not.toHaveProperty("publicTitle");
      }

      const choiceRes = await publicOrdersRouter.request("/book-choices", { method: "GET" });
      expect(choiceRes.status).toBe(200);
      const choiceJson = await choiceRes.json();
      const choice = ((choiceJson.data as unknown[]) as PublicChoice[]).find((b) => b.bookId === bookId);
      expect(choice?.title).toBe(`Judul Ramah ${stamp}`);
      expect(choice).not.toHaveProperty("isbn");
      const wprChoice = ((choiceJson.data as unknown[]) as PublicChoice[]).find((b) => b.bookId === WPR_BOOK_ID);
      expect(wprChoice?.title).toBe(WPR_TITLE);

      const schRes = await publicOrdersRouter.request("/schools", { method: "GET" });
      expect(schRes.status).toBe(200);
      const schJson = await schRes.json();
      expect(schJson.data.some((s: any) => s.id === schoolId)).toBe(true);
      expect(schJson.data.every((s: any) => s.id !== undefined)).toBe(true);
    } finally {
      const { bookPackageItems: bom } = await import("../../db/schema");
      await db.delete(bom).where(inArray(bom.id, [`bom-pub-${stamp}`, `bom-wpr-${stamp}`]));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("GET /api/packages staf tetap 401 tanpa sesi", async () => {
    const { packagesRouter } = await import("./packages");
    const res = await packagesRouter.request("/", { method: "GET" });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { message: string }).message).toMatch(/login/i);
  });
});

describe("WPR wajib satuan buku (750rb, bebas bila sudah paket)", () => {
  it("satuan tanpa paket kena WPR; setelah ada order paket jadi hijau", async () => {
    const stamp = Date.now();
    const schoolId = `school-wpr-${stamp}`;
    const studentId = crypto.randomUUID();
    const bookId = `book-wpr-${stamp}`;
    const now = new Date().toISOString();
    const addr = "Jl. WPR No. 1, RT 01 RW 02, Serpong 15310";
    await db.insert(schools).values({
      id: schoolId, name: `WPR School ${stamp}`, code: `WPR-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    });
    await db.insert(students).values({
      id: studentId, schoolId, nis: `WPR${String(stamp).slice(-6)}`, name: `WPR Kid ${stamp}`,
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", createdAt: now, updatedAt: now,
    });
    await db.insert(books).values({
      id: bookId, isbn: `ISBN-WPR-${stamp}`, title: `WPR Book ${stamp}`,
      author: "A", publisher: "P", price: 50000, sellPrice: 60000, createdAt: now, updatedAt: now,
    });
    await db.insert(bookItems).values({
      id: `bi-wpr-${stamp}`, bookId, currentSchoolId: schoolId,
      barcode: `WPR-${stamp}`, condition: "new", status: "in_stock", createdAt: now, updatedAt: now,
    });
    const pkgId = `pkg-wpr-${stamp}`;
    await db.insert(bookPackages).values({
      id: pkgId, code: `PKG-WPR-${stamp}`, name: "Paket WPR",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      price: 900000, createdAt: now, updatedAt: now,
    });
    try {
      const eligBefore = await publicOrdersRouter.request(`/wpr-eligibility?studentId=${studentId}`, { method: "GET" });
      expect(eligBefore.status).toBe(200);
      expect((await eligBefore.json()).data.needsWpr).toBe(true);

      const first = await submitPublicOrder(
        {
          studentId,
          looseItems: [{ bookId, quantity: 1 }],
          homeAddress: addr,
          orderType: "regular",
          payment: {
            transferAmount: 60000 + 750000,
            bookAllocationAmount: 60000 + 750000,
            paymentProofBase64: "data:image/jpeg;base64,dGVzdC13cHItcHJvb2Y=",
          },
        },
        { database: db, storage: new MemoryStorageService(), getSatuanStatus: openSatuan() }
      );
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.data.wprCharged).toBe(true);
      expect(first.data.totalAmount).toBe(60000 + 750000);
      const wprLines = await db.select().from(studentOrderItems).where(eq(studentOrderItems.orderId, first.data.order.id));
      expect(wprLines.some((l: typeof studentOrderItems.$inferSelect) => l.bookId === "book-wpr-weekly-report" && l.unitPriceSnapshot === 750000)).toBe(true);

      await db.insert(studentBookOrders).values({
        id: `ord-wpr-pkg-${stamp}`, orderNumber: `ORD-WPRP-${String(stamp).slice(-6)}`,
        studentId, schoolId, packageId: pkgId, orderType: "regular",
        paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 900000, paidAmount: 900000, createdAt: now, updatedAt: now,
      });
      const eligAfter = await publicOrdersRouter.request(`/wpr-eligibility?studentId=${studentId}`, { method: "GET" });
      expect((await eligAfter.json()).data.needsWpr).toBe(false);

      await db.insert(bookItems).values({
        id: `bi-wpr2-${stamp}`, bookId, currentSchoolId: schoolId,
        barcode: `WPR2-${stamp}`, condition: "new", status: "in_stock", createdAt: now, updatedAt: now,
      });
      const second = await submitPublicOrder(
        {
          studentId,
          looseItems: [{ bookId, quantity: 1 }],
          homeAddress: addr,
          orderType: "regular",
          payment: {
            transferAmount: 60000,
            bookAllocationAmount: 60000,
            paymentProofBase64: "data:image/jpeg;base64,dGVzdC13cHItcHJvb2Yy",
          },
        },
        { database: db, storage: new MemoryStorageService(), getSatuanStatus: openSatuan() }
      );
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.data.wprCharged).toBe(false);
      expect(second.data.totalAmount).toBe(60000);
    } finally {
      const orders = await db.select({ id: studentBookOrders.id }).from(studentBookOrders).where(eq(studentBookOrders.studentId, studentId));
      for (const oid of orders.map((o: { id: string }) => o.id)) {
        await db.delete(studentOrderItems).where(eq(studentOrderItems.orderId, oid));
        await db.delete(studentBookOrders).where(eq(studentBookOrders.id, oid));
      }
      await db.delete(bookItems).where(eq(bookItems.bookId, bookId));
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
      await db.delete(books).where(eq(books.id, bookId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});

describe("Klaim bukti transfer = pending sampai verifikasi gudang", () => {
  it("klaim baru tidak mengubah order; order lunas menolak klaim", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `test-claim-${stamp}`;
    const studentId = `st-claim-${stamp}`;
    const paidOrderId = `ord-claim-paid-${stamp}`;
    const pendingOrderId = `ord-claim-pending-${stamp}`;
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Klaim", code: `ALW-CLAIM-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-CLAIM-${stamp}`, name: "Siswa Klaim",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", parentName: "Ortu", parentPhone: "081200000000",
      createdAt: now, updatedAt: now,
    });
    try {
      await db.insert(studentBookOrders).values([
        {
          id: paidOrderId, orderNumber: `ORD-CLAIMP-${String(stamp).slice(-6)}`, studentId, schoolId,
          orderType: "regular", paymentStatus: "paid", fulfillmentStatus: "waiting_preparation",
          totalAmount: 100000, paidAmount: 100000, paymentToken: `tok-paid-${stamp}`,
          createdAt: now, updatedAt: now,
        },
        {
          id: pendingOrderId, orderNumber: `ORD-CLAIMU-${String(stamp).slice(-6)}`, studentId, schoolId,
          orderType: "regular", paymentStatus: "unpaid", fulfillmentStatus: "waiting_preparation",
          totalAmount: 100000, paidAmount: 0, paymentToken: `tok-pending-${stamp}`,
          createdAt: now, updatedAt: now,
        },
      ]);

      const blocked = await publicOrdersRouter.request(`/confirm/tok-paid-${stamp}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferAmount: 100000, allocationAmount: 100000 }),
      });
      expect(blocked.status).toBe(400);
      expect((await blocked.json()).message).toMatch(/lunas/i);

      const claim = await publicOrdersRouter.request(`/confirm/tok-pending-${stamp}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferAmount: 100000, allocationAmount: 100000, bankName: "BCA" }),
      });
      expect(claim.status).toBe(201);
      const claimJson = await claim.json();
      expect(claimJson.data.paymentStatus).toBe("unpaid");
      expect(claimJson.data.paidAmount).toBe(0);

      const rows = await selectReceiptsForOrder(pendingOrderId);
      expect(rows).toHaveLength(1);
      expect(rows[0].receipt.verifiedAt).toBeNull();
      expect(rows[0].receipt.rejectedAt).toBeNull();
    } finally {
      await deleteReceiptsForOrders([paidOrderId, pendingOrderId]);
      await db.delete(studentBookOrders).where(inArray(studentBookOrders.id, [paidOrderId, pendingOrderId]));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});

describe("Struk bayar ganda di intake publik", () => {
  it("bank + nomor referensi yang sama ditolak 409, bukan 400 generik", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `test-dup-${stamp}`;
    const studentId = `st-dup-${stamp}`;
    const pkgId = `pkg-dup-${stamp}`;
    const referenceNumber = `DUP-REF-${stamp}`;
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Duplikat", code: `ALW-DUP-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-DUP-${stamp}`, name: "Siswa Duplikat",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      status: "active", parentName: "Ortu", parentPhone: "081200000000",
      createdAt: now, updatedAt: now,
    });
    await db.insert(bookPackages).values({
      id: pkgId, code: `PKG-DUP-${stamp}`, name: "Paket Duplikat",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      price: 100000, createdAt: now, updatedAt: now,
    });
    const payload = {
      studentId,
      packageId: pkgId,
      orderType: "regular",
      payment: {
        transferAmount: 100000,
        bookAllocationAmount: 100000,
        bankName: "BCA",
        referenceNumber,
        paymentProofBase64: "data:image/jpeg;base64,ZHVwLXByb29m",
      },
    };
    try {
      const first = await publicOrdersRouter.request("/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(first.status).toBe(201);

      const second = await publicOrdersRouter.request("/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(second.status).toBe(409);
      expect((await second.json()).message).toMatch(/referensi/i);
    } finally {
      const orders = await db
        .select({ id: studentBookOrders.id })
        .from(studentBookOrders)
        .where(eq(studentBookOrders.studentId, studentId));
      await deleteReceiptsForOrders(orders.map((order: { id: string }) => order.id));
      for (const order of orders) {
        await db.delete(studentOrderItems).where(eq(studentOrderItems.orderId, order.id));
        await db.delete(studentBookOrders).where(eq(studentBookOrders.id, order.id));
      }
      await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("Public return-address endpoint > terbuka tanpa login dan menyajikan alamat gudang", async () => {
    const res = await publicOrdersRouter.request("/return-address", { method: "GET" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { recipientName: string; postalCode: string } };
    expect(json.success).toBe(true);
    expect(json.data.recipientName).toContain("Gudang");
    expect(json.data.postalCode).toBeDefined();
  });
});
