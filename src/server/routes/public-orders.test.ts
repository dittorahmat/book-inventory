import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { publicOrdersRouter } from "./public-orders";
import { db } from "../../db";
import { schools, students, bookPackages, studentBookOrders } from "../../db/schema";

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
