import { Hono } from "hono";
import { db } from "../../db";
import { PERIOD_RE } from "../lib/period";
import { accessErrorResponse, requireScopedActor } from "../services/access-scope";
import { buildReconciliation } from "../services/reconciliation";

export const reconciliationRouter = new Hono();

/** Rekonsiliasi per sekolah + periode: uang masuk wali ↔ tagihan cabang ↔ klaim. */
reconciliationRouter.get("/", async (c) => {
  try {
    const requested = c.req.query("schoolId");
    const { scope } = await requireScopedActor(db, c, requested);
    const schoolId = scope.length === 1 ? scope[0] : requested;
    const period = c.req.query("period") ?? "";
    if (!PERIOD_RE.test(period)) {
      return c.json({ success: false, message: "Periode wajib format YYYY-MM." }, 400);
    }
    return c.json({ success: true, data: await buildReconciliation(db, { period, schoolId }) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
