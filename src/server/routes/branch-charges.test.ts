import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { branchCharges, schools } from "../../db/schema";
import { runWriteBatch } from "../lib/d1-write";
import { emitChargeQuery, finalizeChargeQuery } from "../services/branch-charges";
import { branchChargesRouter } from "./branch-charges";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => restoreActor());

const now = () => new Date().toISOString();

async function seedSchool(id: string) {
  await db.insert(schools).values({
    id, name: `Sekolah ${id}`, code: `CD-${id}`.slice(0, 20),
    type: "branch", createdAt: now(), updatedAt: now(),
  }).onConflictDoNothing();
}

const emit = (schoolId: string, sourceId: string, goodsAmount: number) =>
  runWriteBatch(db, [
    emitChargeQuery(db, {
      schoolId, sourceType: "uniform_order", sourceId, triggerEvent: "order_created", goodsAmount,
    }),
  ]);

describe("Tagihan Cabang API", () => {
  it("terbit open, idempoten per sumber, dan menjadi final saat ongkir masuk", async () => {
    const stamp = Date.now();
    const schoolId = `sch-chg-${stamp}`;
    const sourceId = `uo-${stamp}`;
    try {
      await seedSchool(schoolId);
      await emit(schoolId, sourceId, 750000);
      await emit(schoolId, sourceId, 750000); // pemanggilan kedua tidak menggandakan

      const [created] = await db.select().from(branchCharges).where(eq(branchCharges.sourceId, sourceId));
      expect(created.status).toBe("open");
      expect(created.goodsAmount).toBe(750000);
      expect(created.shippingAmount).toBe(0);
      expect(created.triggerEvent).toBe("order_created");
      expect(created.chargeNumber).toStartWith("TGH-");

      await runWriteBatch(db, [finalizeChargeQuery(db, "uniform_order", sourceId, 25000)]);

      const rows = await db.select().from(branchCharges).where(eq(branchCharges.sourceId, sourceId));
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("final");
      expect(rows[0].shippingAmount).toBe(25000);
    } finally {
      await db.delete(branchCharges).where(eq(branchCharges.sourceId, sourceId));
      await db.delete(schools).where(eq(schools.id, schoolId));
    }
  });

  it("daftar kerja menunggu ongkir: filter status + isolasi cabang", async () => {
    const stamp = Date.now();
    const schoolA = `sch-chga-${stamp}`;
    const schoolB = `sch-chgb-${stamp}`;
    const openId = `uo-open-${stamp}`;
    const finalId = `uo-final-${stamp}`;
    const otherId = `uo-other-${stamp}`;
    try {
      await seedSchool(schoolA);
      await seedSchool(schoolB);
      await emit(schoolA, openId, 500000);
      await emit(schoolA, finalId, 300000);
      await emit(schoolB, otherId, 200000);
      await runWriteBatch(db, [finalizeChargeQuery(db, "uniform_order", finalId, 15000)]);

      mockActor("branch_admin", schoolA);
      const openOnly = await branchChargesRouter.request("/?status=open");
      expect(openOnly.status).toBe(200);
      const openJson = await openOnly.json();
      const openSourceIds = openJson.data.map((row: { sourceId: string }) => row.sourceId);
      expect(openSourceIds).toContain(openId);
      expect(openSourceIds).not.toContain(finalId);
      expect(openSourceIds).not.toContain(otherId);

      const all = await branchChargesRouter.request("/");
      const allSourceIds = (await all.json()).data.map((row: { sourceId: string }) => row.sourceId);
      expect(allSourceIds).toContain(finalId);
      expect(allSourceIds).not.toContain(otherId);

      mockActor("central_admin", null);
      const central = await branchChargesRouter.request(`/?schoolId=${schoolB}`);
      const centralSourceIds = (await central.json()).data.map((row: { sourceId: string }) => row.sourceId);
      expect(centralSourceIds).toContain(otherId);
    } finally {
      await db.delete(branchCharges).where(inArray(branchCharges.sourceId, [openId, finalId, otherId]));
      await db.delete(schools).where(inArray(schools.id, [schoolA, schoolB]));
    }
  });
});
