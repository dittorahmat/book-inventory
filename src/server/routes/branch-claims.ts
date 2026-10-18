import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { accessErrorResponse, requireScopedActor, resolveLogisticsActor } from "../services/access-scope";
import { fail } from "../lib/route-fail";
import { claimSchema } from "../lib/uniform-schemas";
import { createBranchClaim, getBranchClaim, listBranchClaims, lockBranchClaim } from "../services/branch-claims";

export const branchClaimsRouter = new Hono();

branchClaimsRouter.get("/claims", async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const schoolId = scope.length === 1 ? scope[0] : c.req.query("schoolId");
    return c.json({ success: true, data: await listBranchClaims(db, schoolId) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

branchClaimsRouter.post("/claims", zValidator("json", claimSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await createBranchClaim(db, c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

branchClaimsRouter.get("/claims/:id", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await getBranchClaim(db, c.req.param("id"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

branchClaimsRouter.post("/claims/:id/lock", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await lockBranchClaim(db, c.req.param("id"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
