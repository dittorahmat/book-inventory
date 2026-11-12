import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import { systemSettings } from "../../db/schema";
import { writeNow } from "../lib/d1-write";

export const DEMO_STOCK_OVERRIDE_KEY = "demo_stock_override_enabled";

/**
 * Cek apakah mode override stok demo aktif ('true').
 */
export async function isDemoStockOverrideEnabled(
  database: AppDatabase
): Promise<boolean> {
  const row = await database
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, DEMO_STOCK_OVERRIDE_KEY))
    .limit(1);

  return row.length > 0 && row[0]?.value === "true";
}

/**
 * Simpan status mode override stok demo ('true' | 'false').
 */
export async function setDemoStockOverrideEnabled(
  database: AppDatabase,
  enabled: boolean
): Promise<{ enabled: boolean }> {
  const now = writeNow();
  const value = enabled ? "true" : "false";

  await database
    .insert(systemSettings)
    .values({
      key: DEMO_STOCK_OVERRIDE_KEY,
      value,
      description: "Toggle mode override jumlah stok langsung untuk demo / inisialisasi",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value,
        updatedAt: now,
      },
    });

  return { enabled };
}

/**
 * Guard exception bila override stok diakses saat setting mati.
 */
export class DemoStockOverrideDisabledError extends Error {
  constructor() {
    super("Mode override stok demo sedang nonaktif. Aktifkan di Pengaturan terlebih dahulu.");
    this.name = "DemoStockOverrideDisabledError";
  }
}

/**
 * Memastikan mode demo aktif, lempar DemoStockOverrideDisabledError bila mati.
 */
export async function assertDemoStockOverrideActive(
  database: AppDatabase
): Promise<void> {
  const active = await isDemoStockOverrideEnabled(database);
  if (!active) {
    throw new DemoStockOverrideDisabledError();
  }
}
