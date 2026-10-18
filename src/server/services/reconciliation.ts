import { and, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { branchCharges, paymentAllocations, paymentReceipts, uniformClaims } from "../../db/schema";
import { periodBounds } from "../lib/period";

/**
 * Satu layar rekonsiliasi: uang masuk dari wali, tagihan ke cabang, dan klaim.
 * Seluruh angka dihitung sebagai agregat SQL — dilarang `SELECT`-all lalu
 * difilter di JS (§11).
 */

export interface ReconciliationResult {
  period: string;
  moneyIn: { receiptCount: number; amount: number };
  allocations: { buku: number; seragam: number; total: number };
  unallocated: { receiptCount: number; amount: number };
  charges: {
    open: { count: number; goodsAmount: number };
    final: { count: number; goodsAmount: number; shippingAmount: number };
  };
  unbilled: { count: number; amount: number };
  claims: { count: number; totalAmount: number; goodsAmount: number; shippingAmount: number };
  difference: number;
}

const num = (value: unknown): number => Number(value ?? 0);

export const buildReconciliation = async (
  database: AppDatabase,
  input: { period: string; schoolId?: string }
): Promise<ReconciliationResult> => {
  const { start, end } = periodBounds(input.period);
  const school = input.schoolId;
  const receiptScope = [
    gte(paymentReceipts.receivedAt, start),
    lt(paymentReceipts.receivedAt, end),
    isNotNull(paymentReceipts.verifiedAt),
    isNull(paymentReceipts.rejectedAt),
    school ? eq(paymentReceipts.schoolId, school) : undefined,
  ];

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

  const chargeScope = [school ? eq(branchCharges.schoolId, school) : undefined];
  const [openCharges] = await database
    .select({ count: sql<number>`count(*)`, goodsAmount: sql<number>`coalesce(sum(${branchCharges.goodsAmount}), 0)` })
    .from(branchCharges)
    .where(and(...chargeScope, eq(branchCharges.status, "open")));
  const [finalCharges] = await database
    .select({
      count: sql<number>`count(*)`,
      goodsAmount: sql<number>`coalesce(sum(${branchCharges.goodsAmount}), 0)`,
      shippingAmount: sql<number>`coalesce(sum(${branchCharges.shippingAmount}), 0)`,
    })
    .from(branchCharges)
    .where(and(...chargeScope, eq(branchCharges.status, "final"), gte(branchCharges.finalizedAt, start), lt(branchCharges.finalizedAt, end)));
  const [unbilled] = await database
    .select({
      count: sql<number>`count(*)`,
      amount: sql<number>`coalesce(sum(${branchCharges.goodsAmount} + ${branchCharges.shippingAmount}), 0)`,
    })
    .from(branchCharges)
    .where(and(...chargeScope, eq(branchCharges.status, "final"), isNull(branchCharges.claimId)));

  const [claims] = await database
    .select({
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`coalesce(sum(${uniformClaims.totalAmount}), 0)`,
      goodsAmount: sql<number>`coalesce(sum(${uniformClaims.goodsAmount}), 0)`,
      shippingAmount: sql<number>`coalesce(sum(${uniformClaims.shippingAmount}), 0)`,
    })
    .from(uniformClaims)
    .where(and(school ? eq(uniformClaims.schoolId, school) : undefined, eq(uniformClaims.period, input.period)));

  const moneyInAmount = num(money?.amount);
  const claimAmount = num(claims?.totalAmount);
  return {
    period: input.period,
    moneyIn: { receiptCount: num(money?.receiptCount), amount: moneyInAmount },
    allocations: { buku, seragam, total: buku + seragam },
    unallocated: { receiptCount: num(unallocated?.receiptCount), amount: num(unallocated?.amount) },
    charges: {
      open: { count: num(openCharges?.count), goodsAmount: num(openCharges?.goodsAmount) },
      final: {
        count: num(finalCharges?.count),
        goodsAmount: num(finalCharges?.goodsAmount),
        shippingAmount: num(finalCharges?.shippingAmount),
      },
    },
    unbilled: { count: num(unbilled?.count), amount: num(unbilled?.amount) },
    claims: {
      count: num(claims?.count),
      totalAmount: claimAmount,
      goodsAmount: num(claims?.goodsAmount),
      shippingAmount: num(claims?.shippingAmount),
    },
    difference: moneyInAmount - claimAmount,
  };
};
