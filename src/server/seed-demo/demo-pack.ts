import type { SeedContext } from "./context";
import { seedDemoBranches } from "./demo-branches";
import { seedDemoBooks } from "./demo-books";
import { seedDemoFinance } from "./demo-finance";
import { seedDemoLogistics } from "./demo-logistics";
import { seedDemoPayments } from "./demo-payments";
import { seedDemoProcurementOps } from "./demo-procurement-ops";
import { seedDemoSettings } from "./demo-settings";
import { seedDemoUniform } from "./demo-uniform";

/**
 * Demo pack operasional penuh. Urutan mengikuti FK: pengaturan → order buku →
 * kampus → seragam → logistik → pengadaan → pembayaran → keuangan.
 */
export async function seedDemoPack(ctx: SeedContext): Promise<void> {
  await seedDemoSettings(ctx);
  await seedDemoBooks(ctx);
  await seedDemoBranches(ctx);
  await seedDemoUniform(ctx);
  await seedDemoLogistics(ctx);
  await seedDemoProcurementOps(ctx);
  await seedDemoPayments(ctx);
  await seedDemoFinance(ctx);
}
