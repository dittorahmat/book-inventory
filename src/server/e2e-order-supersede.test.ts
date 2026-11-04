import { describe, it, expect, beforeAll, afterEach } from "bun:test";
import { db } from "../db";
import { mockActor, restoreActor } from "./routes/test-actor";
import {
  studentBookOrders,
  refundSlips,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { publicOrdersRouter } from "./routes/public-orders";
import { studentOrdersRouter } from "./routes/student-orders";
import { createTestBook, createTestPackage, createTestSchool, createTestStudent } from "./lib/test-fixtures";

describe("E2E Order Replacement & Supersede Flow (ADR-0021)", () => {
  const schoolId = "sch-e2e-supersede";
  const studentId = "std-e2e-supersede";
  const oldPkgId = "pkg-e2e-old";
  const newPkgId = "pkg-e2e-new";

  afterEach(() => {
    restoreActor();
  });

  beforeAll(async () => {
    await createTestSchool(db, {
      id: schoolId,
      name: "Sekolah E2E Supersede",
      code: "E2E-SUP",
    });

    await createTestBook(db, {
      id: "book-e2e-1",
      title: "Buku Cambridge 1",
    });

    await createTestStudent(db, {
      id: studentId,
      schoolId,
      name: "Ananda E2E",
      nis: "NIS-E2E-001",
      gender: "male",
      gradeLevel: "1",
      academicYear: "2026/2027",
      curriculumType: "international",
      status: "active",
    });

    await createTestPackage(db, {
      id: oldPkgId,
      code: "PKG-E2E-OLD",
      academicYear: "2026/2027",
      gradeLevel: "1",
      curriculumType: "international",
      name: "Paket Lama Cambridge",
      price: 1500000,
    });

    await createTestPackage(db, {
      id: newPkgId,
      code: "PKG-E2E-NEW",
      academicYear: "2026/2027",
      gradeLevel: "1",
      curriculumType: "national",
      name: "Paket Baru Nasional",
      price: 1000000,
    });
  });

  it("completes full cycle: order gantung -> deteksi gantung -> submit penggantian -> realokasi & refund -> audit view staf", async () => {
    const samplePng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    // 1. Submit pesanan awal (buku 1.5jt, lunas)
    const submitOldRes = await publicOrdersRouter.request("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        packageId: oldPkgId,
        orderType: "regular",
        parentPhoneManual: "08123456789",
        payment: {
          transferAmount: 1500000,
          bookAllocationAmount: 1500000,
          bankName: "BCA",
          referenceNumber: "E2E-REF-001",
          paymentProofBase64: samplePng,
        },
      }),
    });
    expect(submitOldRes.status).toBe(201);
    const oldOrderJson = await submitOldRes.json();
    const oldOrderId = oldOrderJson.data.order.id;
    expect(oldOrderJson.data.paymentStatus).toBe("paid");

    // 2. Deteksi pesanan gantung via endpoint /check-pending/:studentId
    const checkRes = await publicOrdersRouter.request(`/check-pending/${studentId}`);
    expect(checkRes.status).toBe(200);
    const checkJson = await checkRes.json();
    expect(checkJson.success).toBe(true);
    expect(checkJson.data.bookOrder).not.toBeNull();
    expect(checkJson.data.bookOrder.id).toBe(oldOrderId);
    expect(checkJson.data.bookOrder.totalAmount).toBe(1500000);

    // 3. Ortu memilih revisi: submit order baru (paket 1jt) dengan replacePendingOrderId
    const submitNewRes = await publicOrdersRouter.request("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        packageId: newPkgId,
        replacePendingOrderId: oldOrderId,
        orderType: "regular",
        parentPhoneManual: "08123456789",
        payment: {
          transferAmount: 1000000,
          bookAllocationAmount: 1000000,
          bankName: "BCA",
          referenceNumber: "E2E-REF-002",
          paymentProofBase64: samplePng,
        },
      }),
    });
    expect(submitNewRes.status).toBe(201);
    const newOrderJson = await submitNewRes.json();
    const newOrderId = newOrderJson.data.order.id;

    // 4. Verifikasi di DB: pesanan lama superseded, pesanan baru lunas (1jt), ada slip refund 500rb
    const [dbOld] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, oldOrderId));
    const [dbNew] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, newOrderId));

    expect(dbOld.fulfillmentStatus).toBe("superseded");
    expect(dbOld.supersededByOrderId).toBe(newOrderId);
    expect(dbOld.paidAmount).toBe(0);

    expect(dbNew.fulfillmentStatus).toBe("waiting_preparation");
    expect(dbNew.paymentStatus).toBe("paid");
    expect(dbNew.paidAmount).toBe(1000000);

    // Cek slip refund kelebihan 500rb
    const slips = await db.select().from(refundSlips).where(eq(refundSlips.orderId, newOrderId));
    expect(slips.length).toBe(1);
    expect(slips[0].refundAmount).toBe(500000);

    // 5. Cek tampilan staf (GET /api/student-orders) memuat pesanan superseded
    mockActor("central_admin", null);
    const staffRes = await studentOrdersRouter.request(`/?schoolId=${schoolId}`);
    expect(staffRes.status).toBe(200);
    const staffJson = await staffRes.json();
    const ordersList = staffJson.data as Array<{ id: string; fulfillmentStatus: string; supersededByOrderId?: string; paymentStatus: string }>;
    const foundOld = ordersList.find((o) => o.id === oldOrderId);
    const foundNew = ordersList.find((o) => o.id === newOrderId);

    expect(foundOld).toBeDefined();
    expect(foundOld?.fulfillmentStatus).toBe("superseded");
    expect(foundOld?.supersededByOrderId).toBe(newOrderId);

    expect(foundNew).toBeDefined();
    expect(foundNew?.fulfillmentStatus).toBe("waiting_preparation");
    expect(foundNew?.paymentStatus).toBe("paid");
  });
});
