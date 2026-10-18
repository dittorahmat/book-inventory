import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";
import { inArray } from "drizzle-orm";
import { db } from "../../db";
import { branchCharges, paymentAllocations, paymentReceipts, schools, uniformClaims } from "../../db/schema";
import { runWriteBatch } from "../lib/d1-write";
import { emitChargeQuery, finalizeChargeQuery } from "../services/branch-charges";
import { reconciliationRouter } from "./reconciliation";

beforeEach(() => mockActor("central_admin", null));
afterEach(() => restoreActor());

const now = () => new Date().toISOString();
const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

async function seedSchool(id: string) {
  await db.insert(schools).values({
    id, name: `Sekolah ${id}`, code: `RC-${id}`.slice(0, 20),
    type: "branch", createdAt: now(), updatedAt: now(),
  }).onConflictDoNothing();
}

describe("Rekonsiliasi API", () => {
  it("memisahkan uang masuk, saldo belum dialokasikan, tagihan, dan klaim", async () => {
    const stamp = Date.now();
    const schoolId = `sch-rc-${stamp}`;
    const receiptId = `rcp-rc-${stamp}`;
    const chargeOk = `uo-rc-ok-${stamp}`;
    const chargeOpen = `uo-rc-open-${stamp}`;
    try {
      await seedSchool(schoolId);
      // Struk Rp10.000.000 dengan alokasi buku Rp1.000.000 → saldo 9.000.000 belum dialokasikan.
      await db.insert(paymentReceipts).values({
        id: receiptId, studentId: `st-rc-${stamp}`, schoolId, amount: 10000000,
        bankName: "BCA", referenceNumber: `RC-${stamp}`, receivedAt: now(), verifiedAt: now(),
        createdAt: now(), updatedAt: now(),
      }).onConflictDoNothing();
      await db.insert(paymentAllocations).values({
        id: `alc-rc-${stamp}`, receiptId, orderId: `ord-rc-${stamp}`, kind: "buku" as const,
        amount: 1000000, createdAt: now(),
      });
      await runWriteBatch(db, [
        emitChargeQuery(db, { schoolId, sourceType: "uniform_order", sourceId: chargeOk, triggerEvent: "order_created", goodsAmount: 750000 }),
        emitChargeQuery(db, { schoolId, sourceType: "uniform_order", sourceId: chargeOpen, triggerEvent: "order_created", goodsAmount: 250000 }),
      ]);
      await runWriteBatch(db, [finalizeChargeQuery(db, "uniform_order", chargeOk, 25000)]);

      const res = await reconciliationRouter.request(`/?schoolId=${schoolId}&period=${period}`);
      expect(res.status).toBe(200);
      const data = (await res.json()).data;
      expect(data.moneyIn).toEqual({ receiptCount: 1, amount: 10000000 });
      expect(data.allocations).toEqual({ buku: 1000000, seragam: 0, total: 1000000 });
      expect(data.unallocated).toEqual({ receiptCount: 1, amount: 9000000 });
      expect(data.charges.open).toEqual({ count: 1, goodsAmount: 250000 });
      expect(data.charges.final).toEqual({ count: 1, goodsAmount: 750000, shippingAmount: 25000 });
      expect(data.unbilled).toEqual({ count: 1, amount: 775000 });
      expect(data.claims).toEqual({ count: 0, totalAmount: 0, goodsAmount: 0, shippingAmount: 0 });
      expect(data.difference).toBe(10000000);
    } finally {
      await db.delete(paymentAllocations).where(inArray(paymentAllocations.receiptId, [receiptId]));
      await db.delete(paymentReceipts).where(inArray(paymentReceipts.id, [receiptId]));
      await db.delete(branchCharges).where(inArray(branchCharges.sourceId, [chargeOk, chargeOpen]));
      await db.delete(uniformClaims).where(inArray(uniformClaims.schoolId, [schoolId]));
      await db.delete(schools).where(inArray(schools.id, [schoolId]));
    }
  });

  it("isolasi cabang dan validasi periode", async () => {
    const stamp = Date.now();
    const schoolA = `sch-rc2a-${stamp}`;
    const schoolB = `sch-rc2b-${stamp}`;
    const receiptB = `rcp-rc2b-${stamp}`;
    try {
      await seedSchool(schoolA);
      await seedSchool(schoolB);
      await db.insert(paymentReceipts).values({
        id: receiptB, studentId: `st-rc2b-${stamp}`, schoolId: schoolB, amount: 5000000,
        bankName: "BNI", referenceNumber: `RC2B-${stamp}`, receivedAt: now(), verifiedAt: now(),
        createdAt: now(), updatedAt: now(),
      }).onConflictDoNothing();

      mockActor("branch_admin", schoolA);
      const isolated = await reconciliationRouter.request(`/?period=${period}`);
      expect(isolated.status).toBe(200);
      expect((await isolated.json()).data.moneyIn).toEqual({ receiptCount: 0, amount: 0 });

      mockActor("central_admin", null);
      const scoped = await reconciliationRouter.request(`/?schoolId=${schoolB}&period=${period}`);
      expect((await scoped.json()).data.moneyIn).toEqual({ receiptCount: 1, amount: 5000000 });

      const bad = await reconciliationRouter.request(`/?schoolId=${schoolB}&period=2026-13`);
      expect(bad.status).toBe(400);
    } finally {
      await db.delete(paymentReceipts).where(inArray(paymentReceipts.id, [receiptB]));
      await db.delete(schools).where(inArray(schools.id, [schoolA, schoolB]));
    }
  });
});
