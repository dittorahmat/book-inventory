import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";
import { inArray } from "drizzle-orm";
import { db } from "../../db";
import { branchCharges, schools, uniformClaims } from "../../db/schema";
import { runWriteBatch } from "../lib/d1-write";
import { emitChargeQuery, finalizeChargeQuery } from "../services/branch-charges";
import { createUniformClaim } from "../services/uniform";
import { uniformClaimsRouter } from "./uniform-claims";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => restoreActor());

const now = () => new Date().toISOString();

async function seedSchool(id: string) {
  await db.insert(schools).values({
    id, name: `Sekolah ${id}`, code: `CL-${id}`.slice(0, 20),
    type: "branch", createdAt: now(), updatedAt: now(),
  }).onConflictDoNothing();
}

describe("Klaim Cabang API", () => {
  it("klaim hanya memuat tagihan final dan terisolasi per cabang", async () => {
    const stamp = Date.now();
    const schoolA = `sch-cla-${stamp}`;
    const schoolB = `sch-clb-${stamp}`;
    const sourceA = `uo-cla-${stamp}`;
    const sourceB = `uo-clb-${stamp}`;
    const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    try {
      await seedSchool(schoolA);
      await seedSchool(schoolB);
      await runWriteBatch(db, [
        emitChargeQuery(db, { schoolId: schoolA, sourceType: "uniform_order", sourceId: sourceA, triggerEvent: "order_created", goodsAmount: 400000 }),
        emitChargeQuery(db, { schoolId: schoolB, sourceType: "uniform_order", sourceId: sourceB, triggerEvent: "order_created", goodsAmount: 900000 }),
      ]);
      // Hanya tagihan cabang A yang final; B tetap open.
      await runWriteBatch(db, [finalizeChargeQuery(db, "uniform_order", sourceA, 20000)]);

      const claimA = await createUniformClaim(db, { schoolId: schoolA, period });
      expect(claimA.ok).toBe(true);
      if (!claimA.ok) return;
      expect(claimA.data.totalAmount).toBe(420000);
      expect(claimA.data.shippingAmount).toBe(20000);

      const claimB = await createUniformClaim(db, { schoolId: schoolB, period });
      if (!claimB.ok) throw new Error("klaim B gagal dibuat");
      expect(claimB.data.totalAmount).toBe(0);

      mockActor("branch_admin", schoolA);
      const list = await uniformClaimsRouter.request("/claims");
      expect(list.status).toBe(200);
      const rows = (await list.json()).data as Array<{ schoolId: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].schoolId).toBe(schoolA);

      // Detail klaim adalah operasi logistik (gudang/pusat), bukan cabang.
      mockActor("central_admin", null);
      const detail = await uniformClaimsRouter.request(`/claims/${claimA.data.id}`);
      expect(detail.status).toBe(200);
      const detailData = (await detail.json()).data as {
        charges: Array<{ sourceId: string }>;
        claim: { totalAmount: number };
      };
      expect(detailData.claim.totalAmount).toBe(420000);
      expect(detailData.charges.map((c) => c.sourceId)).toEqual([sourceA]);
    } finally {
      await db.delete(uniformClaims).where(inArray(uniformClaims.schoolId, [schoolA, schoolB]));
      await db.delete(branchCharges).where(inArray(branchCharges.schoolId, [schoolA, schoolB]));
      await db.delete(schools).where(inArray(schools.id, [schoolA, schoolB]));
    }
  });
});
