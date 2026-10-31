import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { mockActor, restoreActor } from "./test-actor";
import { uniformsRouter } from "./uniforms";
import { db } from "../../db";
import { schools, students, uniformVariants, uniformStock, uniformOrders, uniformOrderItems, uniformExchanges } from "../../db/schema";

describe("Uniform sports exchange actions & resolution", () => {
  it("mendukung alur review sports exchange dengan ready stock dan backorder", async () => {
    const schoolId = "sch-sp-ex";
    const studentId = "std-sp-ex";
    const orderId = "uo-sp-ex";
    const vId = "uv-sp-ex";
    const now = new Date().toISOString();

    await db.insert(schools).values({
      id: schoolId,
      name: "Sekolah Sports Exchange",
      code: "SCH-SP-EX",
      type: "branch",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    await db.insert(students).values({
      id: studentId,
      name: "Murid Sports Ex",
      schoolId,
      nis: "NIS-SP-01",
      gender: "male",
      gradeLevel: "1",
      academicYear: "2026/2027",
      status: "active",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    await db.insert(uniformVariants).values({
      id: vId,
      name: "Baju Olahraga SD",
      code: "VAR-SP-SD",
      academicYear: "2026/2027",
      kind: "olahraga",
      gender: "male",
      jenjang: "sd",
      price: 120000,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    // Stok size S = 0 (Backorder), size M = 5 (Ready)
    await db.insert(uniformStock).values([
      { id: "stk-sp-s", variantId: vId, size: "S", quantity: 0, updatedAt: now },
      { id: "stk-sp-m", variantId: vId, size: "M", quantity: 5, updatedAt: now },
      { id: "stk-sp-l", variantId: vId, size: "L", quantity: 2, updatedAt: now },
    ]).onConflictDoNothing();

    await db.insert(uniformOrders).values({
      id: orderId,
      orderNumber: "UO-SP-01",
      studentId,
      schoolId,
      academicYear: "2026/2027",
      homeAddressSnapshot: "Jl. Pendidikan No. 10",
      totalAmount: 120000,
      paidAmount: 120000,
      paymentStatus: "paid",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    await db.insert(uniformOrderItems).values({
      id: "uoi-sp-01",
      orderId,
      variantId: vId,
      size: "L",
      quantity: 1,
      unitPriceSnapshot: 120000,
      createdAt: now,
    }).onConflictDoNothing();

    // 1. Kasus Tukar ke Size M (Ready)
    const exIdReady = "ex-sp-ready";
    await db.insert(uniformExchanges).values({
      id: exIdReady,
      orderId,
      studentId,
      oldVariantId: vId,
      oldSize: "L",
      newVariantId: vId,
      newSize: "M",
      reason: "Ukuran kebesaran",
      status: "requested",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    mockActor("warehouse_admin", null);
    try {
      // Cek stok pengganti
      const chkRes = await uniformsRouter.request(`/exchanges/${exIdReady}/check-stock`, { method: "GET" });
      expect(chkRes.status).toBe(200);
      const chkJson = (await chkRes.json()) as { success: boolean; data: { available: boolean; quantity: number } };
      expect(chkJson.data.available).toBe(true);
      expect(chkJson.data.quantity).toBe(5);

      // Approve ready dengan resi pengganti
      const appRes = await uniformsRouter.request(`/exchanges/${exIdReady}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_ready",
          replacementResi: "JNE-REP-9988",
        }),
      });
      expect(appRes.status).toBe(200);
      const appJson = (await appRes.json()) as { success: boolean; data: { status: string }; details: { replacementResi: string } };
      expect(appJson.data.status).toBe("approved");
      expect(appJson.details.replacementResi).toBe("JNE-REP-9988");
      // Detail kini hidup di baris exchange, bukan JSON system_settings.
      const [rowReady] = await db.select().from(uniformExchanges).where(eq(uniformExchanges.id, exIdReady));
      expect(rowReady.replacementResi).toBe("JNE-REP-9988");
    } finally {
      restoreActor();
    }

    // 2. Kasus Tukar ke Size S (Backorder)
    const exIdBo = "ex-sp-bo";
    await db.insert(uniformExchanges).values({
      id: exIdBo,
      orderId,
      studentId,
      oldVariantId: vId,
      oldSize: "L",
      newVariantId: vId,
      newSize: "S",
      reason: "Tukar ke S tapi stok 0",
      status: "requested",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    mockActor("warehouse_admin", null);
    try {
      // Approve backorder dengan tanggal estimasi
      const boRes = await uniformsRouter.request(`/exchanges/${exIdBo}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_backorder",
          estimatedShipDate: "2026-11-15",
        }),
      });
      expect(boRes.status).toBe(200);
      const boJson = (await boRes.json()) as { success: boolean; data: { status: string }; details: { estimatedShipDate: string } };
      expect(boJson.data.status).toBe("approved");
      expect(boJson.details.estimatedShipDate).toBe("2026-11-15");
      const [rowBo] = await db.select().from(uniformExchanges).where(eq(uniformExchanges.id, exIdBo));
      expect(rowBo.estimatedShipDate).toBe("2026-11-15");
    } finally {
      restoreActor();
    }
  });
});
