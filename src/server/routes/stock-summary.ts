import { Hono, type Context } from "hono";
import { db } from "../../db";
import {
  accessErrorResponse,
  loadLocationIds,
  requireAuthenticatedActor,
  resolveLocationScope,
  resolveRequestActor,
} from "../services/access-scope";
import {
  getLooseStockSummary,
  getPackageStockSummary,
} from "../services/stock-summary";

/** Endpoint agregasi stok: satu baris per judul/paket per lokasi (spec: inventory-summary). */
export const stockSummaryRouter = new Hono();

async function resolveScope(c: Context) {
  const actor = requireAuthenticatedActor(await resolveRequestActor(c));
  const locations = await loadLocationIds(db);
  const schoolId = c.req.query("schoolId");
  return resolveLocationScope(actor, schoolId, locations);
}

stockSummaryRouter.get("/loose", async (c) => {
  try {
    const scope = await resolveScope(c);
    const rows = await getLooseStockSummary(db, scope);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

stockSummaryRouter.get("/packages", async (c) => {
  try {
    const scope = await resolveScope(c);
    const rows = await getPackageStockSummary(db, scope);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

/** Ringkasan gabungan satuan + paket untuk satu lokasi, dipakai dashboard dan halaman stok. */
stockSummaryRouter.get("/overview", async (c) => {
  try {
    const scope = await resolveScope(c);
    const [loose, packages] = await Promise.all([
      getLooseStockSummary(db, scope),
      getPackageStockSummary(db, scope),
    ]);

    const byLocation = scope.map((schoolId) => {
      const looseRows = loose.filter((r) => r.schoolId === schoolId);
      const packageRows = packages.filter((r) => r.schoolId === schoolId);
      return {
        schoolId,
        looseTitleCount: looseRows.length,
        looseTotalQty: looseRows.reduce((s, r) => s + r.totalQty, 0),
        looseAvailableQty: looseRows.reduce((s, r) => s + r.availableQty, 0),
        packageTypeCount: packageRows.length,
        packageTotalQty: packageRows.reduce((s, r) => s + r.totalQty, 0),
        packageReadyQty: packageRows.reduce((s, r) => s + r.readyQty, 0),
        loose: looseRows,
        packages: packageRows,
      };
    });

    return c.json({ success: true, data: byLocation });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
