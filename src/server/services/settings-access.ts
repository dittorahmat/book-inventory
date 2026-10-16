import type { Context } from "hono";
import { requireCentralAdmin, resolveLogisticsActor, resolveRequestActor } from "./access-scope";

/**
 * Satu pintu otorisasi pengaturan (behavior identik per area):
 * cut-off → wajib login + peran logistik (pusat/gudang);
 * notifikasi → hanya central admin (anon → 401, non-pusat → 403).
 * Dipindah dari route agar cut-off vs notifikasi berbagi satu seam
 * dan route pengaturan tinggal memilih area.
 */
export const assertSettingsAdmin = async (c: Context, area: "cutoff" | "notif"): Promise<void> => {
  if (area === "notif") requireCentralAdmin(await resolveRequestActor(c));
  else await resolveLogisticsActor(c);
};
