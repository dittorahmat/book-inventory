import type { AppDatabase } from "../../db";
import { systemSettings } from "../../db/schema";

/**
 * Kanonik pembaca settings: satu SELECT + Object.fromEntries.
 * Satu-satunya pemilik bentuk map settings — dipakai ulang modul email
 * dan whatsapp agar prioritas kredensial dibaca dari satu tempat.
 */
export const readSettingsMap = async (database: AppDatabase): Promise<Record<string, string>> => {
  const rows: Array<{ key: string; value: string }> = await database.select().from(systemSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
};
