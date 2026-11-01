import { describe, expect, it, beforeAll } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../../src/server/index";
import { db } from "../../src/db";
import {
  studentBookOrders,
  packageItems,
  bookReturns,
  uniformRefunds,
} from "../../src/db/schema";
import { mockActor, restoreActor } from "../../src/server/routes/test-actor";
import { DUMMY_PROOF_IMAGE, seedDemoDatabase } from "./helpers";

describe("E2E Skenario Bisnis: Pembatalan Siswa Mengundurkan Diri (ADR-0019 / AGENTS.md §0.18 & §0.31)", () => {
  beforeAll(async () => {
    await seedDemoDatabase();
  });

  it("Buku: Ortu ajukan pembatalan siswa mundur via portal -> staf setujui -> paket ter-unassign & slip RET-B terbit", async () => {
    // 1. Pilih order buku demo Kayla (ord-kayla-paid, belum serah terima)
    const [kaylaOrderBefore] = await db
      .select()
      .from(studentBookOrders)
      .where(eq(studentBookOrders.id, "ord-kayla-paid"));
    expect(kaylaOrderBefore).toBeDefined();

    // Verifikasi paket terikat sebelum dibatalkan bila ada
    const assignedPackageBefore = kaylaOrderBefore.assignedPackageItemId
      ? await db
          .select()
          .from(packageItems)
          .where(eq(packageItems.id, kaylaOrderBefore.assignedPackageItemId))
      : [];

    // 2. Wali murid mengajukan pembatalan karena siswa mundur lewat portal publik
    // POST /api/public/orders/cancel-withdrawal
    const cancelRes = await app.request("/api/public/orders/cancel-withdrawal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "ord-kayla-paid",
        studentId: kaylaOrderBefore.studentId,
        reason: "Siswa pindah domisili dan mengundurkan diri dari sekolah",
        proofBase64: DUMMY_PROOF_IMAGE,
      }),
    });
    expect(cancelRes.status).toBe(201);
    const cancelJson = await cancelRes.json();
    expect(cancelJson.success).toBe(true);
    expect(cancelJson.data.returnId).toBeDefined();
    const returnId = cancelJson.data.returnId;

    // Verifikasi data return tercatat dengan kind: withdrawal
    const [returnRow] = await db
      .select()
      .from(bookReturns)
      .where(eq(bookReturns.id, returnId));
    expect(returnRow.kind).toBe("withdrawal");
    expect(returnRow.status).toBe("reported");

    // 3. Staf Gudang memeriksa dan menyetujui pembatalan siswa mundur di dashboard
    mockActor("central_admin", null);

    const approveRes = await app.request(
      `/api/student-orders/returns/${returnId}/approve-withdrawal`,
      { method: "POST" }
    );
    expect(approveRes.status).toBe(200);
    const approveJson = await approveRes.json();
    expect(approveJson.success).toBe(true);
    expect(approveJson.data.slipNumber).toMatch(/^RET-B-\d+-\d+$/);

    // 4. Verifikasi mutasi aktif:
    // a. Status pengembalian menjadi approved/processed
    const [returnRowAfter] = await db
      .select()
      .from(bookReturns)
      .where(eq(bookReturns.id, returnId));
    expect(returnRowAfter.status).toBe("approved");

    // b. Alokasi paket fisik di-unassign (stok bebas cabang)
    if (assignedPackageBefore.length > 0) {
      const [orderAfter] = await db
        .select()
        .from(studentBookOrders)
        .where(eq(studentBookOrders.id, "ord-kayla-paid"));
      expect(orderAfter.assignedPackageItemId).toBeNull();
    }

    // c. Verifikasi Slip Pengembalian RET-B dapat diambil via API
    const slipRes = await app.request(
      `/api/student-orders/returns/withdrawal-slip/${approveJson.data.slipNumber}`
    );
    expect(slipRes.status).toBe(200);
    const slipJson = await slipRes.json();
    expect(slipJson.success).toBe(true);
    expect(slipJson.data.slipNumber).toBe(approveJson.data.slipNumber);

    restoreActor();
  });

  it("Seragam: Ortu ajukan refund siswa mundur dengan resi pengembalian -> staf setujui -> restock gudang & slip RET-U terbit", async () => {
    // 1. Wali murid mengajukan pembatalan seragam mundur lewat portal publik
    // POST /api/public/uniform-orders/cancel-withdrawal
    const cancelUniformRes = await app.request(
      "/api/public/uniform-orders/cancel-withdrawal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: "ord-demo-uso-03",
          studentId: "std-farhan-3",
          courierResi: "JNE-RET-778899",
          reason: "Siswa mengundurkan diri dan paket seragam dikirim balik ke gudang pusat",
          letterProofBase64: DUMMY_PROOF_IMAGE,
        }),
      }
    );
    expect(cancelUniformRes.status).toBe(201);
    const cancelUniformJson = await cancelUniformRes.json();
    expect(cancelUniformJson.success).toBe(true);
    const refundId = cancelUniformJson.data.refundId;
    expect(refundId).toBeDefined();

    // Verifikasi tercatat jenis withdrawal
    const [refundRow] = await db
      .select()
      .from(uniformRefunds)
      .where(eq(uniformRefunds.id, refundId));
    expect(refundRow.kind).toBe("withdrawal");
    expect(refundRow.status).toBe("requested");

    // 2. Staf Gudang Seragam menyetujui pengembalian siswa mundur
    mockActor("central_admin", null);

    const approveUniformRes = await app.request(
      `/api/uniforms/refunds/${refundId}/approve-withdrawal`,
      { method: "POST" }
    );
    expect(approveUniformRes.status).toBe(200);
    const approveUniformJson = await approveUniformRes.json();
    expect(approveUniformJson.success).toBe(true);
    expect(approveUniformJson.data.slipNumber).toMatch(/^RET-U-\d+-\d+$/);

    // 3. Verifikasi mutasi aktif:
    // a. Status refund seragam berubah menjadi approved (menunggu pencairan kasir/finance)
    const [refundRowAfter] = await db
      .select()
      .from(uniformRefunds)
      .where(eq(uniformRefunds.id, refundId));
    expect(refundRowAfter.status).toBe("approved");

    // b. Verifikasi Slip Pengembalian RET-U dapat diakses via API
    const slipUniformRes = await app.request(
      `/api/uniforms/withdrawal-slip/${approveUniformJson.data.slipNumber}`
    );
    expect(slipUniformRes.status).toBe(200);
    const slipUniformJson = await slipUniformRes.json();
    expect(slipUniformJson.success).toBe(true);
    expect(slipUniformJson.data.slipNumber).toBe(approveUniformJson.data.slipNumber);

    restoreActor();
  });
});
