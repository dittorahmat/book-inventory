import { Hono } from "hono";
import { db } from "../../db";
import { accessErrorResponse, requireScopedActor } from "../services/access-scope";
import { listCharges, type ChargeStatus } from "../services/branch-charges";

export const branchChargesRouter = new Hono();

/** Tagihan cabang: filter `status=open|final`, plus daftar kerja "menunggu ongkir". */
branchChargesRouter.get("/", async (c) => {
  try {
    const requested = c.req.query("schoolId");
    const { scope } = await requireScopedActor(db, c, requested);
    const schoolId = scope.length === 1 ? scope[0] : requested;
    const raw = c.req.query("status");
    const status: ChargeStatus | undefined = raw === "open" || raw === "final" ? raw : undefined;
    return c.json({ success: true, data: await listCharges(db, { schoolId, status }) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
