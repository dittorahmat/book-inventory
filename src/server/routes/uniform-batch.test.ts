import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => {
  restoreActor();
});
import { uniformBatchRouter } from "./uniform-batch";
import { uniformsRouter } from "./uniforms";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { schools, students, uniformOrders, uniformOrderItems, uniformRejects, uniformStock, uniformVariants } from "../../db/schema";

const postBatch = (path: string, body: unknown) =>
  uniformBatchRouter.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function seedVariant(stamp: string) {
  const now = new Date().toISOString();
  const res = await uniformsRouter.request("/variants", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: `UK-B-${stamp}`, name: "Kain Batch", kind: "kain_harian",
      gender: "male", jenjang: "sd", academicYear: "2026/2027", price: 50000,
    }),
  });
  expect(res.status).toBe(201);
  return { variantId: ((await res.json()).data.variant.id as string), now };
}

describe("Uniform batch: stok manual, export CSV, import ekspedisi", () => {
  it("stok manual add/set + tolak size tak terdaftar", async () => {
    const stamp = Date.now();
    const { variantId, now } = await seedVariant(`${stamp}`);
    const add = await postBatch("/stock/adjust", { variantId, quantity: 7, mode: "add", reason: "Stok awal" });
    expect(add.status).toBe(200);
    expect((await add.json()).data.quantity).toBe(7);
    const set = await postBatch("/stock/adjust", { variantId, quantity: 3, mode: "set", reason: "Opname" });
    expect((await set.json()).data.quantity).toBe(3);
    const badSize = await postBatch("/stock/adjust", { variantId, size: "XXL", quantity: 1, mode: "add", reason: "X" });
    expect(badSize.status).toBe(400);
    const noReason = await postBatch("/stock/adjust", { variantId, quantity: 1, mode: "add", reason: "" });
    expect(noReason.status).toBe(400);
    await db.delete(uniformStock).where(eq(uniformStock.variantId, variantId));
    await db.delete(uniformVariants).where(eq(uniformVariants.id, variantId));
    void now;
  });

  it("export packing vs ekspedisi + import resi/ongkir per NIS", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `test-batch-${stamp}`;
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Batch", code: `ALW-BATCH-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const studentId = `st-batch-${stamp}`;
    await db.insert(students).values({
      id: studentId, schoolId, nis: `NIS-BATCH-${stamp}`, name: "Siswa Batch",
      gender: "male", gradeLevel: "2", curriculumType: "international", academicYear: "2026/2027",
      parentName: "Ortu", parentPhone: "081200000010", status: "active", createdAt: now, updatedAt: now,
    });
    const { variantId } = await seedVariant(`${stamp}x`);
    const orderId = `uord-batch-${stamp}`;
    await db.insert(uniformOrders).values({
      id: orderId, orderNumber: `USO-BATCH-${stamp}`, studentId, schoolId, academicYear: "2026/2027",
      homeAddressSnapshot: "Jl. Batch RT 01 RW 01, Depok 16411",
      shipmentStatus: "belum_dikirim", totalAmount: 50000, paidAmount: 50000,
      paymentStatus: "paid", createdAt: now, updatedAt: now,
    });
    await db.insert(uniformOrderItems).values({
      id: `uoi-batch-${stamp}`, orderId, variantId, size: "—", quantity: 1, unitPriceSnapshot: 50000, createdAt: now,
    });
    try {
      const packing = await uniformBatchRouter.request(`/orders/export?schoolId=${schoolId}&format=packing`, { method: "GET" });
      expect(packing.status).toBe(200);
      const packingText = await packing.text();
      expect(packingText).toContain("nis");
      expect(packingText).toContain(`NIS-BATCH-${stamp}`);
      expect(packingText).toContain("ikhwan");

      const ekspedisi = await uniformBatchRouter.request(`/orders/export?schoolId=${schoolId}&format=ekspedisi`, { method: "GET" });
      expect(ekspedisi.status).toBe(200);
      const ekspText = await ekspedisi.text();
      expect(ekspText).toContain("kontak_ortu");
      expect(ekspText).toContain("081200000010");

      const noSchool = await uniformBatchRouter.request("/orders/export?format=packing", { method: "GET" });
      expect(noSchool.status).toBe(400);

      const imp = await postBatch("/orders/import-shipping", {
        schoolId, markShipped: true,
        rows: [
          { nis: `NIS-BATCH-${stamp}`, resi: "RESI-B-1", ongkir: 18000 },
          { nis: "NIS-HANTU-999", resi: "X", ongkir: 1000 },
        ],
      });
      expect(imp.status).toBe(200);
      const impJson = await imp.json();
      expect(impJson.data.updated).toEqual([`NIS-BATCH-${stamp}`]);
      expect(impJson.data.rejected).toHaveLength(1);
      const [o] = await db.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
      expect(o.shippingCost).toBe(18000);
      expect(o.shippingResi).toBe("RESI-B-1");
      expect(o.shipmentStatus).toBe("sudah_dikirim");
    } finally {
      await db.delete(uniformOrderItems).where(eq(uniformOrderItems.orderId, orderId));
      await db.delete(uniformOrders).where(eq(uniformOrders.id, orderId));
      await db.delete(students).where(eq(students.id, studentId));
      await db.delete(schools).where(eq(schools.id, schoolId));
      await db.delete(uniformStock).where(eq(uniformStock.variantId, variantId));
      await db.delete(uniformVariants).where(eq(uniformVariants.id, variantId));
    }
  });

  it("import 30 baris sekaligus lolos sekuensial (§10 volume produksi)", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `test-bvol-${stamp}`;
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Bvol", code: `ALW-BVOL-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const nises: string[] = [];
    for (let i = 0; i < 30; i++) {
      const studentId = `st-bvol-${stamp}-${i}`;
      const nis = `NIS-BVOL-${stamp}-${i}`;
      nises.push(nis);
      await db.insert(students).values({
        id: studentId, schoolId, nis, name: `Siswa Bvol ${i}`,
        gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
        status: "active", createdAt: now, updatedAt: now,
      });
      await db.insert(uniformOrders).values({
        id: `uord-bvol-${stamp}-${i}`, orderNumber: `USO-BVOL-${stamp}-${i}`,
        studentId, schoolId, academicYear: "2026/2027",
        homeAddressSnapshot: "Jl. Bvol RT 01 RW 01, Depok 16411",
        shipmentStatus: "belum_dikirim", totalAmount: 50000, paidAmount: 50000,
        paymentStatus: "paid", createdAt: now, updatedAt: now,
      });
    }
    try {
      const imp = await postBatch("/orders/import-shipping", {
        schoolId, markShipped: false,
        rows: nises.map((nis, i) => ({ nis, resi: `RESI-BVOL-${i}`, ongkir: 10000 + i })),
      });
      expect(imp.status).toBe(200);
      const impJson = await imp.json();
      expect(impJson.data.updated).toHaveLength(30);
      expect(impJson.data.rejected).toHaveLength(0);
      const [sample] = await db.select().from(uniformOrders).where(eq(uniformOrders.id, `uord-bvol-${stamp}-0`));
      expect(sample.shippingResi).toBe("RESI-BVOL-0");
      expect(sample.shipmentStatus).toBe("belum_dikirim");
    } finally {
      for (let i = 0; i < 30; i++) {
        await db.delete(uniformOrders).where(eq(uniformOrders.id, `uord-bvol-${stamp}-${i}`));
        await db.delete(students).where(eq(students.id, `st-bvol-${stamp}-${i}`));
      }
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("catatan reject seragam: simpan + daftar (gudang)", async () => {
    const stamp = Date.now();
    const { variantId } = await seedVariant(`r${stamp}`);
    try {
      const bad = await postBatch("/rejects", { variantId, quantity: 2, reason: "" });
      expect(bad.status).toBe(400);
      const created = await postBatch("/rejects", { variantId, quantity: 2, reason: "Jahitan lepas" });
      expect(created.status).toBe(201);
      const list = await uniformBatchRouter.request("/rejects", { method: "GET" });
      expect(list.status).toBe(200);
      expect(((await list.json()).data as Array<{ variantId: string }>).some((r) => r.variantId === variantId)).toBe(true);
    } finally {
      await db.delete(uniformRejects).where(eq(uniformRejects.variantId, variantId));
      await db.delete(uniformStock).where(eq(uniformStock.variantId, variantId));
      await db.delete(uniformVariants).where(eq(uniformVariants.id, variantId));
    }
  });

  it("preview & commit bulk upload resi (NIS | NAMA | Resi)", async () => {
    const stamp = Date.now();
    const now = new Date().toISOString();
    const schoolId = `sch-resi-${stamp}`;
    await db.insert(schools).values({
      id: schoolId, name: "Sekolah Resi", code: `ALW-RESI-${stamp}`,
      type: "branch", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();

    const studentId1 = `st-resi-1-${stamp}`;
    const studentId2 = `st-resi-2-${stamp}`;
    const nis1 = `NIS-R1-${stamp}`;
    const nis2 = `NIS-R2-${stamp}`;

    await db.insert(students).values([
      {
        id: studentId1, schoolId, nis: nis1, name: "Ahmad Siswa",
        gradeLevel: "1", curriculumType: "international", academicYear: "2026/2027",
        status: "active", createdAt: now, updatedAt: now,
      },
      {
        id: studentId2, schoolId, nis: nis2, name: "Budi Siswa",
        gradeLevel: "2", curriculumType: "international", academicYear: "2026/2027",
        status: "active", createdAt: now, updatedAt: now,
      },
    ]);

    await db.insert(uniformOrders).values([
      {
        id: `uord-resi-1-${stamp}`, orderNumber: `USO-R1-${stamp}`,
        studentId: studentId1, schoolId, academicYear: "2026/2027",
        homeAddressSnapshot: "Jl. Resi No. 1",
        shipmentStatus: "belum_dikirim", totalAmount: 50000, paidAmount: 50000,
        paymentStatus: "paid", createdAt: now, updatedAt: now,
      },
      {
        id: `uord-resi-2-${stamp}`, orderNumber: `USO-R2-${stamp}`,
        studentId: studentId2, schoolId, academicYear: "2026/2027",
        homeAddressSnapshot: "Jl. Resi No. 2",
        shipmentStatus: "belum_dikirim", totalAmount: 50000, paidAmount: 50000,
        paymentStatus: "paid", createdAt: now, updatedAt: now,
      },
    ]);

    try {
      // Preview
      const previewRes = await postBatch("/orders/bulk-shipping-resi/preview", {
        schoolId,
        rows: [
          { nis: nis1, name: "Ahmad", resi: "RESI-JNE-001" },
          { nis: nis2, name: "Budi", resi: "RESI-JNE-002" },
          { nis: "NIS-TIDAK-ADA", name: "Unknown", resi: "RESI-003" },
        ],
      });
      expect(previewRes.status).toBe(200);
      const previewJson = await previewRes.json();
      expect(previewJson.data.validCount).toBe(2);
      expect(previewJson.data.errorCount).toBe(1);
      expect(previewJson.data.items[0].status).toBe("valid");
      expect(previewJson.data.items[0].orderNumber).toBe(`USO-R1-${stamp}`);
      expect(previewJson.data.items[2].status).toBe("error");

      // Commit
      const commitRes = await postBatch("/orders/bulk-shipping-resi/commit", {
        schoolId,
        rows: [
          { nis: nis1, name: "Ahmad", resi: "RESI-JNE-001" },
          { nis: nis2, name: "Budi", resi: "RESI-JNE-002" },
          { nis: "NIS-TIDAK-ADA", name: "Unknown", resi: "RESI-003" },
        ],
      });
      expect(commitRes.status).toBe(200);
      const commitJson = await commitRes.json();
      expect(commitJson.data.updatedCount).toBe(2);
      expect(commitJson.data.results).toHaveLength(3);
      expect(commitJson.data.results[0].success).toBe(true);
      expect(commitJson.data.results[2].success).toBe(false);

      // Verify DB
      const [order1] = await db.select().from(uniformOrders).where(eq(uniformOrders.id, `uord-resi-1-${stamp}`));
      expect(order1.shippingResi).toBe("RESI-JNE-001");
      expect(order1.shipmentStatus).toBe("sudah_dikirim");
    } finally {
      await db.delete(uniformOrders).where(eq(uniformOrders.schoolId, schoolId));
      await db.delete(students).where(eq(students.schoolId, schoolId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });
});
