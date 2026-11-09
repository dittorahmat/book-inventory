import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { requireAuthenticatedActor, resolveRequestActor } from "../services/access-scope";
import {
  DashboardHttpError,
  getDashboardSummary,
} from "../services/reporting";
import {
  ExecutiveDashboardHttpError,
  getExecutiveDashboardSummary,
} from "../services/reporting/executive-dashboard";
import { idSchema } from "../lib/validators";

export const dashboardRouter = new Hono();

const summaryQuerySchema = z.object({
  schoolId: idSchema.optional(),
});

const executiveQuerySchema = z.object({
  academicYear: z.string().optional(),
  compareAcademicYear: z.string().optional(),
});

dashboardRouter.get("/executive/summary", zValidator("query", executiveQuerySchema), async (c) => {
  const { academicYear, compareAcademicYear } = c.req.valid("query");

  try {
    const actor = requireAuthenticatedActor(await resolveRequestActor(c));
    const data = await getExecutiveDashboardSummary(db, actor, academicYear, compareAcademicYear);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof ExecutiveDashboardHttpError) {
      return c.json({ success: false, message: err.message }, err.status as 400 | 403 | 404);
    }
    throw err;
  }
});

dashboardRouter.get("/summary", zValidator("query", summaryQuerySchema), async (c) => {
  const { schoolId } = c.req.valid("query");

  try {
    // Di dalam try: kegagalan resolve actor (mis. session rusak)
    // dipetakan rapi, bukan jatuh ke envelope 500 generik.
    const actor = requireAuthenticatedActor(await resolveRequestActor(c));
    const data = await getDashboardSummary(db, actor, schoolId);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof DashboardHttpError) {
      return c.json({ success: false, message: err.message }, err.status as 400 | 403 | 404);
    }
    throw err;
  }
});
