import type { AppDatabase } from "../../../db";
import { systemSettings } from "../../../db/schema";
import { readSettingsMap } from "../settings-map";
import { DEFAULT_UNIFORM_CLAIM_PREFIX, UNIFORM_CLAIM_PREFIX_KEY } from "./claims";
import { DEFAULT_UNIFORM_ORDER_PREFIX, UNIFORM_ORDER_PREFIX_KEY, UNIFORM_SATUAN_KEY } from "./orders";

/**
 * Satu-satunya pemilik penomoran + toggle satuan seragam: prefix
 * USO/CLM dan flag on/off satuan tinggal di balik seam uniform,
 * bukan tersebar di route pengaturan. Route hanya meneruskan nilai.
 */
export interface UniformNumbering {
  orderPrefix: string;
  claimPrefix: string;
}

export const getUniformNumbering = async (database: AppDatabase): Promise<UniformNumbering> => {
  const map = await readSettingsMap(database);
  return {
    orderPrefix: map[UNIFORM_ORDER_PREFIX_KEY] ?? DEFAULT_UNIFORM_ORDER_PREFIX,
    claimPrefix: map[UNIFORM_CLAIM_PREFIX_KEY] ?? DEFAULT_UNIFORM_CLAIM_PREFIX,
  };
};

export const saveUniformNumbering = async (database: AppDatabase, input: UniformNumbering): Promise<UniformNumbering> => {
  const now = new Date().toISOString();
  for (const [key, value] of [
    [UNIFORM_ORDER_PREFIX_KEY, input.orderPrefix],
    [UNIFORM_CLAIM_PREFIX_KEY, input.claimPrefix],
  ] as const) {
    await database
      .insert(systemSettings)
      .values({ key, value, description: "Prefix penomoran seragam (customizable)", updatedAt: now })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: now } });
  }
  return input;
};

export const setUniformSatuanEnabled = async (database: AppDatabase, enabled: boolean): Promise<{ open: boolean }> => {
  const now = new Date().toISOString();
  const value = enabled ? "true" : "false";
  await database
    .insert(systemSettings)
    .values({ key: UNIFORM_SATUAN_KEY, value, updatedAt: now })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: now } });
  return { open: enabled };
};
