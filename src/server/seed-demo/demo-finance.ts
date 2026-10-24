import {
  branchCharges,
  branchClaims,
  termReconciliationItems,
  termReconciliations,
} from "../../db/schema";
import { demoPackagePrice } from "./demo-books";
import type { SeedContext } from "./context";

export async function seedDemoFinance({ db: targetDb, now }: SeedContext) {
  const sd1Int = await demoPackagePrice({ db: targetDb, now }, "pkg-sd1-int");
  const sd2Int = await demoPackagePrice({ db: targetDb, now }, "pkg-sd2-int");

  const period = now.slice(0, 7);
  const chargeDefs = [
    { id: "chg-demo-01", number: "TGH-DEMO-0001", schoolId: "school-alw-1", sourceType: "book_order" as const, sourceId: "ord-aisyah-done", trigger: "handover" as const, goods: sd1Int, shipping: 0, claimId: "clm-demo-01" },
    { id: "chg-demo-02", number: "TGH-DEMO-0002", schoolId: "school-alw-1", sourceType: "uniform_order" as const, sourceId: "ord-demo-uso-01", trigger: "order_created" as const, goods: 230000, shipping: 15000, claimId: "clm-demo-01" },
    { id: "chg-demo-03", number: "TGH-DEMO-0003", schoolId: "school-alw-1", sourceType: "uniform_order" as const, sourceId: "ord-demo-uso-02", trigger: "order_created" as const, goods: 230000, shipping: 25000, claimId: "clm-demo-01" },
    { id: "chg-demo-04", number: "TGH-DEMO-0004", schoolId: "school-alw-2", sourceType: "book_order" as const, sourceId: "ord-alw2-paid", trigger: "handover" as const, goods: sd2Int, shipping: 40000, claimId: "clm-demo-02" },
    { id: "chg-demo-05", number: "TGH-DEMO-0005", schoolId: "school-alw-2", sourceType: "uniform_order" as const, sourceId: "ord-demo-uso-05", trigger: "order_created" as const, goods: 230000, shipping: 18000, claimId: "clm-demo-02" },
    { id: "chg-demo-06", number: "TGH-DEMO-0006", schoolId: "school-alw-1", sourceType: "book_order" as const, sourceId: "ord-hendra-unpaid", trigger: "order_created" as const, goods: sd2Int, shipping: 0, claimId: null },
  ];
  for (const charge of chargeDefs) {
    const isFinal = charge.claimId !== null;
    await targetDb
      .insert(branchCharges)
      .values({
        id: charge.id,
        chargeNumber: charge.number,
        schoolId: charge.schoolId,
        sourceType: charge.sourceType,
        sourceId: charge.sourceId,
        triggerEvent: charge.trigger,
        chargeableAt: now,
        finalizedAt: isFinal ? now : null,
        goodsAmount: charge.goods,
        shippingAmount: charge.shipping,
        status: isFinal ? "final" : "open",
        claimId: charge.claimId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: branchCharges.id,
        set: {
          goodsAmount: charge.goods,
          shippingAmount: charge.shipping,
          status: isFinal ? "final" : "open",
          finalizedAt: isFinal ? now : null,
          claimId: charge.claimId,
          updatedAt: now,
        },
      });
  }

  const claim1Goods = sd1Int + 230000 + 230000;
  const claim1Shipping = 40000;
  await targetDb
    .insert(branchClaims)
    .values({
      id: "clm-demo-01",
      claimNumber: `CLM-DEMO-${period}`,
      schoolId: "school-alw-1",
      period,
      status: "draft",
      totalQty: 3,
      goodsAmount: claim1Goods,
      shippingAmount: claim1Shipping,
      totalAmount: claim1Goods + claim1Shipping,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: branchClaims.id,
      set: { totalQty: 3, goodsAmount: claim1Goods, shippingAmount: claim1Shipping, totalAmount: claim1Goods + claim1Shipping, updatedAt: now },
    });

  const claim2Goods = sd2Int + 230000;
  const claim2Shipping = 58000;
  await targetDb
    .insert(branchClaims)
    .values({
      id: "clm-demo-02",
      claimNumber: `CLM-DEMO2-${period}`,
      schoolId: "school-alw-2",
      period,
      status: "locked",
      totalQty: 2,
      goodsAmount: claim2Goods,
      shippingAmount: claim2Shipping,
      totalAmount: claim2Goods + claim2Shipping,
      lockedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: branchClaims.id,
      set: { status: "locked", lockedAt: now, totalQty: 2, goodsAmount: claim2Goods, shippingAmount: claim2Shipping, totalAmount: claim2Goods + claim2Shipping, updatedAt: now },
    });

  // Audit akhir periode: inbound 10, tersalur 1, sisa sistem 9, fisik 7 → loss 2 paket.
  const physicalRemaining = 7;
  const totalInbound = 10;
  const totalDistributed = 1;
  const systemRemaining = totalInbound - totalDistributed;
  const discrepancy = systemRemaining - physicalRemaining;
  const lossAmount = discrepancy * sd1Int;
  await targetDb
    .insert(termReconciliations)
    .values({
      id: "trm-demo-01",
      reconciliationNumber: "BA-RECON-DEMO-0001",
      schoolId: "school-alw-1",
      academicYear: "2026/2027",
      term: "Ganjil",
      status: "finalized",
      notes: "Audit fisik akhir semester Ganjil — 2 paket tidak ditemukan.",
      totalInbound,
      totalDistributed,
      totalSystemRemaining: systemRemaining,
      totalPhysicalRemaining: physicalRemaining,
      totalDiscrepancy: discrepancy,
      totalLossAmount: lossAmount,
      createdByUserId: "usr-admin-gudang",
      finalizedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: termReconciliations.id,
      set: {
        status: "finalized",
        totalInbound,
        totalDistributed,
        totalSystemRemaining: systemRemaining,
        totalPhysicalRemaining: physicalRemaining,
        totalDiscrepancy: discrepancy,
        totalLossAmount: lossAmount,
        finalizedAt: now,
        updatedAt: now,
      },
    });
  await targetDb
    .insert(termReconciliationItems)
    .values({
      id: "tri-demo-01",
      reconciliationId: "trm-demo-01",
      itemType: "package",
      packageId: "pkg-sd1-int",
      totalInbound,
      totalDistributed,
      systemRemaining,
      physicalRemaining,
      discrepancyQuantity: discrepancy,
      unitPrice: sd1Int,
      totalLossAmount: lossAmount,
      notes: "Selisih 2 paket Kelas 1 Internasional.",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: termReconciliationItems.id,
      set: {
        totalInbound,
        totalDistributed,
        systemRemaining,
        physicalRemaining,
        discrepancyQuantity: discrepancy,
        unitPrice: sd1Int,
        totalLossAmount: lossAmount,
        updatedAt: now,
      },
    });

}
