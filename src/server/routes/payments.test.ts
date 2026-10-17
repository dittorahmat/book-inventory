import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});
import { paymentsRouter } from "./payments";
import { publicOrdersRouter } from "./public-orders";
import { db } from "../../db";
import { schools, students, bookPackages, studentBookOrders, orderPayments } from "../../db/schema";
import { eq } from "drizzle-orm";

const postJson = (path: string, body: unknown) =>
  paymentsRouter.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function seedOrder(stamp: number, totalAmount: number, paymentToken: string | null) {
  const schoolId = `test-pay2-school-${stamp}`;
  const now = new Date().toISOString();
  await db.insert(schools).values({
    id: schoolId, name: "Al Wildan Review Test", code: `ALW-REV-${stamp}`,
    type: "branch", createdAt: now, updatedAt: now,
  }).onConflictDoNothing();
  const studentId = `st-rev-${stamp}`;
  await db.insert(students).values({
    id: studentId, schoolId, nis: `NIS-REV-${stamp}`, name: "Budi Review",
    gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
    status: "active", parentName: "Ortu", parentPhone: "081234567800",
    parentEmail: "ortu@contoh.id", createdAt: now, updatedAt: now,
  });
  const orderId = `ord-rev-${stamp}`;
  await db.insert(studentBookOrders).values({
    id: orderId, orderNumber: `ORD-REV-${String(stamp).slice(-6)}`, studentId, schoolId,
    orderType: "regular", paymentStatus: "unpaid", fulfillmentStatus: "waiting_preparation",
    totalAmount, paidAmount: 0, paymentToken, createdAt: now, updatedAt: now,
  });
  return { schoolId, studentId, orderId, now };
}

async function cleanup(schoolId: string, studentId: string, orderId: string) {
  await db.delete(orderPayments).where(eq(orderPayments.orderId, orderId));
  await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
  await db.delete(students).where(eq(students.id, studentId));
  await db.delete(schools).where(eq(schools.id, schoolId));
}

const pendingRow = (id: string, orderId: string, allocation: number, now: string) => ({
  id, orderId, transferAmount: allocation, bookAllocationAmount: allocation,
  bankName: "BCA", notes: "Klaim orang tua", createdAt: now,
});

describe("Payments & Cashier Verification API", () => {
  it("records partial and full cashier payments, and handles scholarship approval", async () => {
    const stamp = Date.now();
    const { schoolId, studentId, orderId, now } = await seedOrder(stamp, 1000000, null);

    const pay1 = await postJson(`/orders/${orderId}/pay`, {
      transferAmount: 3000000, bookAllocationAmount: 400000, bankName: "Mandiri", referenceNumber: "REF-MND-001",
    });
    expect(pay1.status).toBe(200);
    const pay1Json = await pay1.json();
    expect(pay1Json.data.paidAmount).toBe(400000);
    expect(pay1Json.data.remainingAmount).toBe(600000);
    expect(pay1Json.data.paymentStatus).toBe("partial");

    const pay2 = await postJson(`/orders/${orderId}/pay`, {
      transferAmount: 600000, bookAllocationAmount: 600000, bankName: "Mandiri", referenceNumber: "REF-MND-002",
    });
    expect(pay2.status).toBe(200);
    const pay2Json = await pay2.json();
    expect(pay2Json.data.paidAmount).toBe(1000000);
    expect(pay2Json.data.remainingAmount).toBe(0);
    expect(pay2Json.data.paymentStatus).toBe("paid");

    // Scholarship approval tetap lewat jalur beasiswa.
    const pkgId = `pkg-rev-${stamp}`;
    await db.insert(bookPackages).values({
      id: pkgId, code: `PKG-REV-${stamp}`, name: "Paket Review",
      gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
      price: 1000000, createdAt: now, updatedAt: now,
    });
    const schOrderId = `ord-rev-sch-${stamp}`;
    await db.insert(studentBookOrders).values({
      id: schOrderId, orderNumber: `ORD-REVS-${String(stamp).slice(-6)}`, studentId, schoolId,
      packageId: pkgId, orderType: "scholarship", paymentStatus: "scholarship_pending",
      fulfillmentStatus: "waiting_preparation", totalAmount: 0, paidAmount: 0,
      createdAt: now, updatedAt: now,
    });
    const schApprove = await postJson(`/orders/${schOrderId}/scholarship`, { action: "approve" });
    expect(schApprove.status).toBe(200);
    expect((await schApprove.json()).data.paymentStatus).toBe("scholarship_approved");

    await db.delete(studentBookOrders).where(eq(studentBookOrders.id, schOrderId));
    await db.delete(bookPackages).where(eq(bookPackages.id, pkgId));
    await cleanup(schoolId, studentId, orderId);
  });

  it("verify menambah paidAmount + notifikasi, reject tidak mengkredit", async () => {
    const stamp = Date.now();
    const { schoolId, studentId, orderId, now } = await seedOrder(stamp, 100000, `tok-rev-${stamp}`);
    const first = `payv1-${stamp}`;
    const second = `payv2-${stamp}`;
    try {
      await db.insert(orderPayments).values([
        pendingRow(first, orderId, 40000, now),
        pendingRow(second, orderId, 60000, now),
      ]);

      const listed = await paymentsRouter.request(`/orders/${orderId}`);
      expect(listed.status).toBe(200);
      const listedJson = await listed.json();
      expect(listedJson.data.pendingCount).toBe(2);
      expect(listedJson.data.payments.every((p: { status: string }) => p.status === "pending")).toBe(true);

      const verify1 = await paymentsRouter.request(`/orders/${orderId}/payments/${first}/verify`, { method: "POST" });
      expect(verify1.status).toBe(200);
      const verify1Json = await verify1.json();
      expect(verify1Json.data.paymentStatus).toBe("partial");
      expect(verify1Json.data.paidAmount).toBe(40000);
      expect(verify1Json.data.remainingAmount).toBe(60000);
      expect(verify1Json.data.notification).toBeNull();

      const again = await paymentsRouter.request(`/orders/${orderId}/payments/${first}/verify`, { method: "POST" });
      expect(again.status).toBe(400);

      const rejectVerified = await postJson(`/orders/${orderId}/payments/${first}/reject`, { reason: "Sudah diverifikasi" });
      expect(rejectVerified.status).toBe(400);

      const verify2 = await paymentsRouter.request(`/orders/${orderId}/payments/${second}/verify`, { method: "POST" });
      expect(verify2.status).toBe(200);
      const verify2Json = await verify2.json();
      expect(verify2Json.data.paymentStatus).toBe("paid");
      expect(verify2Json.data.paidAmount).toBe(100000);
      expect(verify2Json.data.notification.wa.success).toBe(true);
      expect(verify2Json.data.notification.email.success).toBe(true);

      const listedAfter = await paymentsRouter.request(`/orders/${orderId}`);
      const listedAfterJson = await listedAfter.json();
      expect(listedAfterJson.data.pendingCount).toBe(0);
      const statuses = new Map(
        listedAfterJson.data.payments.map((p: { id: string; status: string }) => [p.id, p.status])
      );
      expect(statuses.get(first)).toBe("verified");
      expect(statuses.get(second)).toBe("verified");
    } finally {
      await cleanup(schoolId, studentId, orderId);
    }
  });

  it("reject menyimpan alasan + tautan unggah ulang; klaim ulang jadi baris pending baru", async () => {
    const stamp = Date.now();
    // paymentToken sengaja null: reject harus membuat tautan (ensureToken reuse).
    const { schoolId, studentId, orderId, now } = await seedOrder(stamp, 100000, null);
    const claimId = `payj1-${stamp}`;
    try {
      await db.insert(orderPayments).values(pendingRow(claimId, orderId, 100000, now));

      const rejectRes = await postJson(`/orders/${orderId}/payments/${claimId}/reject`, { reason: "Bukti buram, mohon unggah ulang." });
      expect(rejectRes.status).toBe(200);
      const rejectJson = await rejectRes.json();
      expect(rejectJson.data.confirmUrl).toContain("/bayar/buku/");
      expect(rejectJson.data.notification.wa.success).toBe(true);

      const [rejected] = await db.select().from(orderPayments).where(eq(orderPayments.id, claimId));
      expect(rejected.rejectedAt).not.toBeNull();
      expect(rejected.rejectReason).toBe("Bukti buram, mohon unggah ulang.");

      const [orderAfterReject] = await db.select().from(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      expect(orderAfterReject.paidAmount).toBe(0);
      expect(orderAfterReject.paymentStatus).toBe("unpaid");

      const rejectAgain = await postJson(`/orders/${orderId}/payments/${claimId}/reject`, { reason: "Lagi" });
      expect(rejectAgain.status).toBe(400);

      // Unggah ulang via tautan yang sama -> baris pending BARU (order tetap unpaid).
      const token = (rejectJson.data.confirmUrl as string).split("/").pop() as string;
      const reClaim = await publicOrdersRouter.request(`/confirm/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferAmount: 100000, allocationAmount: 100000, bankName: "BCA" }),
      });
      expect(reClaim.status).toBe(201);
      expect((await reClaim.json()).data.paymentStatus).toBe("unpaid");

      const rows = await db.select().from(orderPayments).where(eq(orderPayments.orderId, orderId));
      expect(rows.filter((r: typeof orderPayments.$inferSelect) => r.rejectedAt !== null)).toHaveLength(1);
      expect(rows.filter((r: typeof orderPayments.$inferSelect) => r.verifiedAt === null && r.rejectedAt === null)).toHaveLength(1);

      // Verifikasi klaim baru -> order lunas.
      const newClaim = rows.find((r: typeof orderPayments.$inferSelect) => r.verifiedAt === null && r.rejectedAt === null);
      if (!newClaim) throw new Error("klaim baru tidak terbentuk");
      const verifyNew = await paymentsRouter.request(`/orders/${orderId}/payments/${newClaim.id}/verify`, { method: "POST" });
      expect(verifyNew.status).toBe(200);
      expect((await verifyNew.json()).data.paymentStatus).toBe("paid");
    } finally {
      await cleanup(schoolId, studentId, orderId);
    }
  });

  it("volume: 30 klaim pending dihitung sekali grup-baca lalu diverifikasi (§10.5)", async () => {
    const stamp = Date.now();
    const { schoolId, studentId, orderId, now } = await seedOrder(stamp, 300000, `tok-vol-${stamp}`);
    try {
      const ids = Array.from({ length: 30 }, (_, i) => `payvol-${stamp}-${i}`);
      await db.insert(orderPayments).values(ids.map((id) => pendingRow(id, orderId, 10000, now)));

      const listed = await paymentsRouter.request(`/orders/${orderId}`);
      expect((await listed.json()).data.pendingCount).toBe(30);

      for (let i = 0; i < ids.length - 1; i++) {
        const res = await paymentsRouter.request(`/orders/${orderId}/payments/${ids[i]}/verify`, { method: "POST" });
        expect(res.status).toBe(200);
      }
      const last = await paymentsRouter.request(`/orders/${orderId}/payments/${ids[ids.length - 1]}/verify`, { method: "POST" });
      const lastJson = await last.json();
      expect(lastJson.data.paymentStatus).toBe("paid");
      expect(lastJson.data.paidAmount).toBe(300000);

      const listedAfter = await paymentsRouter.request(`/orders/${orderId}`);
      expect((await listedAfter.json()).data.pendingCount).toBe(0);
    } finally {
      await cleanup(schoolId, studentId, orderId);
    }
  });
});
