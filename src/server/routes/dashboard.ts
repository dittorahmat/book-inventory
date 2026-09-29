import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { auth } from "../auth";
import {
  DashboardHttpError,
  getDashboardSummary,
  type DashboardActor,
} from "../services/dashboard-summary";

export const dashboardRouter = new Hono();

const summaryQuerySchema = z.object({
  schoolId: z.string().min(1).optional(),
});

dashboardRouter.get("/summary", zValidator("query", summaryQuerySchema), async (c) => {
  const { schoolId } = c.req.valid("query");

  let actor: DashboardActor | null = null;
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const user = session?.user as unknown as { role?: string; schoolId?: string | null } | undefined;
    if (user && (user.role === "central_admin" || user.role === "branch_admin")) {
      actor = { role: user.role, schoolId: user.schoolId ?? null };
    }
  } catch {
    actor = null;
  }

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
