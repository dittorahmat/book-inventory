import { like, sql } from "drizzle-orm";
import {
  branchCharges,
  branchClaims,
  internalPurchaseOrders,
  internalShipments,
  termReconciliations,
  transferShipments,
  uniformRejects,
  vendorReturns,
} from "../../db/schema";
import type { SeedContext } from "./context";
import { seedDemoBranches } from "./demo-branches";
import { seedDemoBooks } from "./demo-books";
import { seedDemoFinance } from "./demo-finance";
import { seedDemoLogistics } from "./demo-logistics";
import { seedDemoPayments } from "./demo-payments";
import { seedDemoProcurementOps } from "./demo-procurement-ops";
import { seedDemoSettings } from "./demo-settings";
import { seedDemoUniform } from "./demo-uniform";

export interface DemoPackSummary {
  internalPurchaseOrders: number;
  internalShipments: number;
  transferShipments: number;
  vendorReturns: number;
  branchCharges: number;
  branchClaims: number;
  termReconciliations: number;
  uniformRejects: number;
}

const countRows = async (
  ctx: SeedContext,
  prefix: string,
  table:
    | typeof internalPurchaseOrders
    | typeof internalShipments
    | typeof transferShipments
    | typeof vendorReturns
    | typeof branchCharges
    | typeof branchClaims
    | typeof termReconciliations
    | typeof uniformRejects
): Promise<number> => {
  const [row] = await ctx.db
    .select({ value: sql<number>`count(*)` })
    .from(table)
    .where(like(table.id, `${prefix}%`));
  return Number(row?.value ?? 0);
};

/** Ringkasan baris pack yang benar-benar ada (bukan angka fixture). */
export const summarizeDemoPack = async (ctx: SeedContext): Promise<DemoPackSummary> => ({
  internalPurchaseOrders: await countRows(ctx, "ipo-demo-", internalPurchaseOrders),
  internalShipments: await countRows(ctx, "ishp-demo-", internalShipments),
  transferShipments: await countRows(ctx, "trf-demo-", transferShipments),
  vendorReturns: await countRows(ctx, "rtv-demo-", vendorReturns),
  branchCharges: await countRows(ctx, "chg-demo-", branchCharges),
  branchClaims: await countRows(ctx, "clm-demo", branchClaims),
  termReconciliations: await countRows(ctx, "trm-demo-", termReconciliations),
  uniformRejects: await countRows(ctx, "ur-demo-", uniformRejects),
});

/**
 * Demo pack operasional penuh. Urutan mengikuti FK: pengaturan → order buku →
 * kampus → seragam → logistik → pengadaan → pembayaran → keuangan.
 */
export async function seedDemoPack(ctx: SeedContext): Promise<DemoPackSummary> {
  await seedDemoSettings(ctx);
  await seedDemoBooks(ctx);
  await seedDemoBranches(ctx);
  await seedDemoUniform(ctx);
  await seedDemoLogistics(ctx);
  await seedDemoProcurementOps(ctx);
  await seedDemoPayments(ctx);
  await seedDemoFinance(ctx);
  return summarizeDemoPack(ctx);
}
