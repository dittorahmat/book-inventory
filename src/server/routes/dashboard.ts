import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { resolveRequestActor } from "../services/access-scope";
import {
  DashboardHttpError,
  getDashboardSummary,
} from "../services/dashboard-summary";

export const dashboardRouter = new Hono();

const summaryQuerySchema = z.object({
  schoolId: z.string().min(1).optional(),
});

dashboardRouter.get("/summary", zValidator("query", summaryQuerySchema), async (c) => {
  const { schoolId } = c.req.valid("query");

  const actor = await resolveRequestActor(c);

  try {
    const data = await getDashboardSummary(db, actor, schoolId);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof DashboardHttpError) {
      return c.json({ success: false, message: err.message }, err.status as 400 | 403 | 404);
    }
    throw err;
  }
});
