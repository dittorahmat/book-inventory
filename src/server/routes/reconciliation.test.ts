import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mockActor, restoreActor } from "./test-actor";
import { inArray } from "drizzle-orm";
import { db } from "../../db";
import { branchCharges, paymentAllocations, paymentReceipts, schools, branchClaims } from "../../db/schema";
import { runWriteBatch } from "../lib/d1-write";
import { emitChargeQuery, finalizeChargeQuery } from "../services/branch-charges";
import { createBranchClaim, lockBranchClaim } from "../services/branch-claims";
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
      expect(data.charges.open.count).toBe(1);
      expect(data.charges.open.goodsAmount).toBe(250000);
      expect(data.charges.final).toMatchObject({ count: 1, goodsAmount: 750000, shippingAmount: 25000 });
      // Baris buku dan seragam selalu dipisah; keduanya tagihan seragam di sini.
      expect(data.charges.final.byKind.seragam).toEqual({ count: 1, goodsAmount: 750000, shippingAmount: 25000 });
      expect(data.charges.final.byKind.buku).toEqual({ count: 0, goodsAmount: 0, shippingAmount: 0 });
      expect(data.charges.open.byKind.seragam.count).toBe(1);
      expect(data.unbilled).toEqual({ count: 1, amount: 775000 });
      expect(data.claims.count).toBe(0);
      expect(data.claims.totalAmount).toBe(0);
      expect(data.claims.lockedDrift).toEqual({ count: 0, amount: 0 });
      expect(data.difference).toBe(10000000);
    } finally {
      await db.delete(paymentAllocations).where(inArray(paymentAllocations.receiptId, [receiptId]));
      await db.delete(paymentReceipts).where(inArray(paymentReceipts.id, [receiptId]));
      await db.delete(branchCharges).where(inArray(branchCharges.sourceId, [chargeOk, chargeOpen]));
      await db.delete(branchClaims).where(inArray(branchClaims.schoolId, [schoolId]));
      await db.delete(schools).where(inArray(schools.id, [schoolId]));
    }
  });

  it("memisahkan tagihan buku vs seragam dan menandai klaim terkunci yang berubah", async () => {
    const stamp = Date.now();
    const schoolId = `sch-rck-${stamp}`;
    const bookCharge = `bo-rck-${stamp}`;
    const uniformCharge = `uo-rck-${stamp}`;
    const claimId = `clm-rck-${stamp}`;
    try {
      await seedSchool(schoolId);
      await runWriteBatch(db, [
        emitChargeQuery(db, { schoolId, sourceType: "book_order", sourceId: bookCharge, triggerEvent: "handover", goodsAmount: 900000 }),
        emitChargeQuery(db, { schoolId, sourceType: "uniform_order", sourceId: uniformCharge, triggerEvent: "order_created", goodsAmount: 300000 }),
      ]);
      await runWriteBatch(db, [
        finalizeChargeQuery(db, "book_order", bookCharge, 30000),
        finalizeChargeQuery(db, "uniform_order", uniformCharge, 15000),
      ]);

      // Klaim menyerap kedua jenis tagihan, lalu dikunci.
      const claim = await createBranchClaim(db, { schoolId, period });
      if (!claim.ok) throw new Error("klaim gagal dibuat");
      await lockBranchClaim(db, claim.data.id);
      await db.insert(branchClaims).values({
        id: claimId, claimNumber: `CLM-EXTRA-${stamp}`, schoolId, period: "1999-01",
        status: "locked", totalQty: 0, goodsAmount: 500000, shippingAmount: 0, totalAmount: 500000,
        createdAt: now(), updatedAt: now(),
      }).onConflictDoNothing();

      const before = await reconciliationRouter.request(`/?schoolId=${schoolId}&period=${period}`);
      const beforeData = (await before.json()).data;
      expect(beforeData.charges.final.byKind.buku).toEqual({ count: 1, goodsAmount: 900000, shippingAmount: 30000 });
      expect(beforeData.charges.final.byKind.seragam).toEqual({ count: 1, goodsAmount: 300000, shippingAmount: 15000 });
      expect(beforeData.claims.byKind.buku.goodsAmount).toBe(900000);
      expect(beforeData.claims.byKind.seragam.goodsAmount).toBe(300000);
      expect(beforeData.claims.lockedDrift).toEqual({ count: 0, amount: 0 });

      // Ongkir dikoreksi SETELAH klaim dikunci → klaim tidak lagi cocok dengan tagihannya.
      await runWriteBatch(db, [finalizeChargeQuery(db, "book_order", bookCharge, 40000)]);

      const after = await reconciliationRouter.request(`/?schoolId=${schoolId}&period=${period}`);
      const afterData = (await after.json()).data;
      expect(afterData.claims.lockedDrift).toEqual({ count: 1, amount: 10000 });
      expect(afterData.claims.totalAmount).toBe(claim.data.totalAmount);
    } finally {
      await db.delete(branchCharges).where(inArray(branchCharges.sourceId, [bookCharge, uniformCharge]));
      await db.delete(branchClaims).where(inArray(branchClaims.id, [claimId]));
      await db.delete(branchClaims).where(inArray(branchClaims.schoolId, [schoolId]));
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
