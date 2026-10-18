import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { accessErrorResponse, requireScopedActor, resolveLogisticsActor } from "../services/access-scope";
import { fail } from "../lib/route-fail";
import { claimSchema } from "../lib/uniform-schemas";
import { createUniformClaim, getUniformClaim, listUniformClaims, lockUniformClaim } from "../services/uniform";

export const uniformClaimsRouter = new Hono();

uniformClaimsRouter.get("/claims", async (c) => {
  try {
    const { scope } = await requireScopedActor(db, c, c.req.query("schoolId"));
    const schoolId = scope.length === 1 ? scope[0] : c.req.query("schoolId");
    return c.json({ success: true, data: await listUniformClaims(db, schoolId) });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformClaimsRouter.post("/claims", zValidator("json", claimSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await createUniformClaim(db, c.req.valid("json"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformClaimsRouter.get("/claims/:id", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await getUniformClaim(db, c.req.param("id"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

uniformClaimsRouter.post("/claims/:id/lock", async (c) => {
  try {
    await resolveLogisticsActor(c);
    const result = await lockUniformClaim(db, c.req.param("id"));
    if (!result.ok) return fail(c, result);
    return c.json({ success: true, data: result.data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
