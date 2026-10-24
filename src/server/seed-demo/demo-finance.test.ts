import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  branchCharges,
  branchClaims,
  termReconciliationItems,
  termReconciliations,
  uniformOrders,
} from "../../db/schema";
import { compileTermAuditData } from "../services/term-reconciliation";
import { runDemoSeed } from "../seed";

describe("seed demo: rekonsiliasi dan audit periode", () => {
  it("menjaga total klaim = tagihan final dan angka audit konsisten", async () => {
    await runDemoSeed();

    const charges = (await db.select().from(branchCharges)).filter((charge) => charge.id.startsWith("chg-demo-"));
    const finalCharges = charges.filter((charge) => charge.status === "final");
    expect(charges).toHaveLength(6);
    expect(finalCharges).toHaveLength(5);

    const claims = (await db.select().from(branchClaims)).filter((claim) => claim.id.startsWith("clm-demo"));
    for (const claim of claims) {
      const total = finalCharges
        .filter((charge) => charge.claimId === claim.id)
        .reduce((sum, charge) => sum + charge.goodsAmount + charge.shippingAmount, 0);
      expect(total).toBe(claim.totalAmount);
      expect(claim.goodsAmount + claim.shippingAmount).toBe(claim.totalAmount);
    }
    expect(claims.find((claim) => claim.id === "clm-demo-02")?.status).toBe("locked");

    const [recon] = await db.select().from(termReconciliations).where(eq(termReconciliations.id, "trm-demo-01"));
    expect(recon.status).toBe("finalized");
    expect(recon.totalInbound).toBe(10);
    expect(recon.totalDistributed).toBe(1);
    expect(recon.totalSystemRemaining).toBe(9);
    expect(recon.totalPhysicalRemaining).toBe(7);
    expect(recon.totalDiscrepancy).toBe(2);

    const [item] = await db.select().from(termReconciliationItems).where(eq(termReconciliationItems.reconciliationId, "trm-demo-01"));
    expect(item.totalLossAmount).toBe(2 * item.unitPrice);
    expect(recon.totalLossAmount).toBe(item.totalLossAmount);

    // Compile audit melihat inbound yang sama dengan Berita Acara.
    const compiled = await compileTermAuditData(db, {
      schoolId: "school-alw-1",
      academicYear: "2026/2027",
      term: "Ganjil",
    });
    const row = compiled.packages.find((pkg) => pkg.packageId === "pkg-sd1-int");
    expect(row?.totalInbound).toBe(10);
    expect(row?.totalDistributed).toBeGreaterThanOrEqual(1);

    const [uniformOrder] = await db.select().from(uniformOrders).where(eq(uniformOrders.id, "ord-demo-uso-05"));
    expect(uniformOrder.paymentStatus).toBe("paid");
    expect(uniformOrder.schoolId).toBe("school-alw-2");
  });
});
