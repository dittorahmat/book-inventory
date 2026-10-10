import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { schools } from "../../db/schema";
import {
  accessErrorResponse,
  resolveLogisticsActor,
} from "../services/access-scope";

export const schoolsRouter = new Hono();

const createSchoolSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().min(2, "Code must be at least 2 characters").toUpperCase(),
  type: z.enum(["main", "branch", "warehouse"]),
  address: z.string().optional(),
  phone: z.string().optional(),
});

schoolsRouter.get("/", async (c) => {
  const allSchools = await db.select().from(schools);
  return c.json({ success: true, data: allSchools });
});

schoolsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [school] = await db.select().from(schools).where(eq(schools.id, id));
  if (!school) {
    return c.json({ success: false, message: "School not found" }, 404);
  }
  return c.json({ success: true, data: school });
});

schoolsRouter.post("/", zValidator("json", createSchoolSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const body = c.req.valid("json");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // If type is main, check if a main school already exists
  if (body.type === "main") {
    const existingMain = await db.select().from(schools).where(eq(schools.type, "main"));
    if (existingMain.length > 0) {
      return c.json({ success: false, message: "Main school already registered" }, 400);
    }
  }

  // Single-warehouse policy: only one warehouse location is allowed
  if (body.type === "warehouse") {
    const existingWarehouse = await db.select().from(schools).where(eq(schools.type, "warehouse"));
    if (existingWarehouse.length > 0) {
      return c.json({ success: false, message: "Gudang logistik sudah terdaftar (hanya satu gudang)" }, 400);
    }
  }

  const [newSchool] = await db
    .insert(schools)
    .values({
      id,
      name: body.name,
      code: body.code,
      type: body.type,
      address: body.address,
      phone: body.phone,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ success: true, data: newSchool }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

const updateSchoolSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  code: z.string().min(2, "Code must be at least 2 characters").toUpperCase().optional(),
  type: z.enum(["main", "branch", "warehouse"]).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

schoolsRouter.put("/:id", zValidator("json", updateSchoolSchema), async (c) => {
  try {
    await resolveLogisticsActor(c);
    const id = c.req.param("id");
  const body = c.req.valid("json");
  const now = new Date().toISOString();

  const [existing] = await db.select().from(schools).where(eq(schools.id, id));
  if (!existing) {
    return c.json({ success: false, message: "School not found" }, 404);
  }

  // If changing type to main, check if another main school already exists
  if (body.type === "main" && existing.type !== "main") {
    const existingMain = await db.select().from(schools).where(eq(schools.type, "main"));
    if (existingMain.length > 0) {
      return c.json({ success: false, message: "Main school already registered" }, 400);
    }
  }

  const [updatedSchool] = await db
    .update(schools)
    .set({
      ...body,
      updatedAt: now,
    })
    .where(eq(schools.id, id))
    .returning();

  return c.json({ success: true, data: updatedSchool });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});