import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { branchCharges, paymentAllocations, paymentReceipts, branchClaims } from "../../db/schema";
import { selectInChunks } from "../lib/d1-write";
import { periodBounds } from "../lib/period";

/**
 * Satu layar rekonsiliasi: uang masuk dari wali, tagihan ke cabang, dan klaim.
 * Seluruh angka dihitung sebagai agregat SQL — dilarang `SELECT`-all lalu
 * difilter di JS (§11). Baris buku dan seragam selalu dipisah supaya satu
 * laporan menjawab keduanya.
 */

export interface KindSplitRow {
  count: number;
  goodsAmount: number;
  shippingAmount: number;
}

export interface KindSplit {
  buku: KindSplitRow;
  seragam: KindSplitRow;
}

export interface ReconciliationResult {
  period: string;
  moneyIn: { receiptCount: number; amount: number };
  allocations: { buku: number; seragam: number; total: number };
  unallocated: { receiptCount: number; amount: number };
  charges: {
    open: { count: number; goodsAmount: number; byKind: KindSplit };
    final: { count: number; goodsAmount: number; shippingAmount: number; byKind: KindSplit };
  };
  unbilled: { count: number; amount: number };
  claims: {
    count: number;
    totalAmount: number;
    goodsAmount: number;
    shippingAmount: number;
    byKind: KindSplit;
    /** Klaim terkunci yang angkanya tidak lagi cocok dengan tagihan di bawahnya. */
    lockedDrift: { count: number; amount: number };
  };
  difference: number;
}

const num = (value: unknown): number => Number(value ?? 0);

const emptySplitRow = (): KindSplitRow => ({ count: 0, goodsAmount: 0, shippingAmount: 0 });
const emptySplit = (): KindSplit => ({ buku: emptySplitRow(), seragam: emptySplitRow() });

const kindKey = (sourceType: string): keyof KindSplit => (sourceType === "book_order" ? "buku" : "seragam");

export const buildReconciliation = async (
  database: AppDatabase,
  input: { period: string; schoolId?: string }
): Promise<ReconciliationResult> => {
  const { start, end } = periodBounds(input.period);
  const school = input.schoolId;
  const receiptScope = [
    eq(paymentReceipts.direction, "in"),
    gte(paymentReceipts.receivedAt, start),
    lt(paymentReceipts.receivedAt, end),
    isNotNull(paymentReceipts.verifiedAt),
    isNull(paymentReceipts.rejectedAt),
    school ? eq(paymentReceipts.schoolId, school) : undefined,
  ];
  const chargeScope = [school ? eq(branchCharges.schoolId, school) : undefined];

  const [money] = await database
    .select({ receiptCount: sql<number>`count(*)`, amount: sql<number>`coalesce(sum(${paymentReceipts.amount}), 0)` })
    .from(paymentReceipts)
    .where(and(...receiptScope));

  const allocationRows = await database
    .select({ kind: paymentAllocations.kind, total: sql<number>`coalesce(sum(${paymentAllocations.amount}), 0)` })
    .from(paymentAllocations)
    .innerJoin(paymentReceipts, eq(paymentReceipts.id, paymentAllocations.receiptId))
    .where(and(...receiptScope))
    .groupBy(paymentAllocations.kind);
  const buku = num(allocationRows.find((r) => r.kind === "buku")?.total);
  const seragam = num(allocationRows.find((r) => r.kind === "seragam")?.total);

  const receiptTotals = database
    .select({
      amount: paymentReceipts.amount,
      allocated: sql<number>`coalesce(sum(${paymentAllocations.amount}), 0)`.as("allocated"),
    })
    .from(paymentReceipts)
    .leftJoin(paymentAllocations, eq(paymentAllocations.receiptId, paymentReceipts.id))
    .where(and(...receiptScope))
    .groupBy(paymentReceipts.id)
    .as("receipt_totals");
  const [unallocated] = await database
    .select({
      receiptCount: sql<number>`count(*)`,
      amount: sql<number>`coalesce(sum(${receiptTotals.amount} - ${receiptTotals.allocated}), 0)`,
    })
    .from(receiptTotals)
    .where(sql`${receiptTotals.amount} > ${receiptTotals.allocated}`);

  const chargeRowsOf = (status: "open" | "final") =>
    database
      .select({
        sourceType: branchCharges.sourceType,
        count: sql<number>`count(*)`,
        goodsAmount: sql<number>`coalesce(sum(${branchCharges.goodsAmount}), 0)`,
        shippingAmount: sql<number>`coalesce(sum(${branchCharges.shippingAmount}), 0)`,
      })
      .from(branchCharges)
      .where(
        and(
          ...chargeScope,
          eq(branchCharges.status, status),
          status === "final" ? gte(branchCharges.finalizedAt, start) : undefined,
          status === "final" ? lt(branchCharges.finalizedAt, end) : undefined
        )
      )
      .groupBy(branchCharges.sourceType);

  const openCharges = { count: 0, goodsAmount: 0, byKind: emptySplit() };
  const finalCharges = { count: 0, goodsAmount: 0, shippingAmount: 0, byKind: emptySplit() };
  for (const row of await chargeRowsOf("open")) {
    openCharges.count += num(row.count);
    openCharges.goodsAmount += num(row.goodsAmount);
    openCharges.byKind[kindKey(row.sourceType)] = {
      count: num(row.count),
      goodsAmount: num(row.goodsAmount),
      shippingAmount: num(row.shippingAmount),
    };
  }
  for (const row of await chargeRowsOf("final")) {
    finalCharges.count += num(row.count);
    finalCharges.goodsAmount += num(row.goodsAmount);
    finalCharges.shippingAmount += num(row.shippingAmount);
    finalCharges.byKind[kindKey(row.sourceType)] = {
      count: num(row.count),
      goodsAmount: num(row.goodsAmount),
      shippingAmount: num(row.shippingAmount),
    };
  }

  const [unbilled] = await database
    .select({
      count: sql<number>`count(*)`,
      amount: sql<number>`coalesce(sum(${branchCharges.goodsAmount} + ${branchCharges.shippingAmount}), 0)`,
    })
    .from(branchCharges)
    .where(and(...chargeScope, eq(branchCharges.status, "final"), isNull(branchCharges.claimId)));

  const claimRows = await database
    .select()
    .from(branchClaims)
    .where(and(school ? eq(branchClaims.schoolId, school) : undefined, eq(branchClaims.period, input.period)))
    .limit(500);
  const claimIds = claimRows.map((claim) => claim.id);
  const claimChargeRows = claimIds.length > 0
    ? await selectInChunks(claimIds, (chunk) =>
        database
          .select({
            claimId: branchCharges.claimId,
            sourceType: branchCharges.sourceType,
            goodsAmount: sql<number>`coalesce(sum(${branchCharges.goodsAmount}), 0)`,
            shippingAmount: sql<number>`coalesce(sum(${branchCharges.shippingAmount}), 0)`,
          })
          .from(branchCharges)
          .where(inArray(branchCharges.claimId, chunk))
          .groupBy(branchCharges.claimId, branchCharges.sourceType)
      )
    : [];

  const claimsByKind = emptySplit();
  const chargedPerClaim = new Map<string, number>();
  for (const row of claimChargeRows) {
    const split = claimsByKind[kindKey(row.sourceType)];
    split.count += 1;
    split.goodsAmount += num(row.goodsAmount);
    split.shippingAmount += num(row.shippingAmount);
    const key = row.claimId ?? "";
    chargedPerClaim.set(key, (chargedPerClaim.get(key) ?? 0) + num(row.goodsAmount) + num(row.shippingAmount));
  }

  // Klaim terkunci yang total simpannya sudah tidak sama dengan tagihan di
  // bawahnya (mis. ongkir dikoreksi setelah klaim dikunci) — selisih diam
  // adalah yang dilarang, jadi ia dihitung dan ditampilkan.
  let driftCount = 0;
  let driftAmount = 0;
  for (const claim of claimRows) {
    if (claim.status !== "locked") continue;
    const charged = chargedPerClaim.get(claim.id) ?? 0;
    const drift = charged - claim.totalAmount;
    if (drift !== 0) {
      driftCount += 1;
      driftAmount += Math.abs(drift);
    }
  }

  const claimTotals = claimRows.reduce(
    (acc, claim) => ({
      totalAmount: acc.totalAmount + claim.totalAmount,
      goodsAmount: acc.goodsAmount + claim.goodsAmount,
      shippingAmount: acc.shippingAmount + claim.shippingAmount,
    }),
    { totalAmount: 0, goodsAmount: 0, shippingAmount: 0 }
  );

  const moneyInAmount = num(money?.amount);
  return {
    period: input.period,
    moneyIn: { receiptCount: num(money?.receiptCount), amount: moneyInAmount },
    allocations: { buku, seragam, total: buku + seragam },
    unallocated: { receiptCount: num(unallocated?.receiptCount), amount: num(unallocated?.amount) },
    charges: {
      open: openCharges,
      final: finalCharges,
    },
    unbilled: { count: num(unbilled?.count), amount: num(unbilled?.amount) },
    claims: {
      count: claimRows.length,
      ...claimTotals,
      byKind: claimsByKind,
      lockedDrift: { count: driftCount, amount: driftAmount },
    },
    difference: moneyInAmount - claimTotals.totalAmount,
  };
};
