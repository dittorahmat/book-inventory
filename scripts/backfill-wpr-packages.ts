import { db, type AppDatabase } from "../src/db";
import { bookPackages } from "../src/db/schema";
import { ensurePackageHasWpr } from "../src/server/services/wpr";
import { recalcPackagePrice } from "../src/server/services/pricing";

export interface BackfillWprResult {
  totalPackages: number;
  updatedPackages: number;
}

/**
 * Menelusuri seluruh paket buku dan memastikan masing-masing memiliki WPR di BOM,
 * serta menghitung ulang harga paket secara all-in (§0.28). Idempoten.
 */
export async function backfillWprPackages(database: AppDatabase = db): Promise<BackfillWprResult> {
  const allPackages = await database.select({ id: bookPackages.id, code: bookPackages.code }).from(bookPackages);
  let updatedCount = 0;

  for (const pkg of allPackages) {
    await ensurePackageHasWpr(database, pkg.id);
    await recalcPackagePrice(database, pkg.id);
    updatedCount++;
  }

  return {
    totalPackages: allPackages.length,
    updatedPackages: updatedCount,
  };
}

if (import.meta.main) {
  console.log("Memulai backfill WPR untuk seluruh paket buku...");
  const res = await backfillWprPackages(db);
  console.log(`Backfill selesai: ${res.updatedPackages}/${res.totalPackages} paket buku disinkronkan dengan WPR.`);
  process.exit(0);
}
