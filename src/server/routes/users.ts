import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users, schools } from "../../db/schema";
import { auth } from "../auth";

export const usersRouter = new Hono();

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["central_admin", "branch_admin"]),
  schoolId: z.string().optional().nullable(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["central_admin", "branch_admin"]).optional(),
  schoolId: z.string().optional().nullable(),
});

// GET /api/users
usersRouter.get("/", async (c) => {
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      schoolId: users.schoolId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      school: {
        id: schools.id,
        name: schools.name,
        code: schools.code,
        type: schools.type,
      },
    })
    .from(users)
    .leftJoin(schools, eq(users.schoolId, schools.id));

  return c.json({ success: true, data: allUsers });
});

// POST /api/users
usersRouter.post("/", zValidator("json", createUserSchema), async (c) => {
  const body = c.req.valid("json");

  // Validate branch_admin must have schoolId
  if (body.role === "branch_admin" && !body.schoolId) {
    return c.json({ success: false, message: "Branch administrator must be assigned to a school" }, 400);
  }

  // If schoolId is provided, check school existence
  if (body.schoolId) {
    const [schoolExists] = await db.select().from(schools).where(eq(schools.id, body.schoolId));
    if (!schoolExists) {
      return c.json({ success: false, message: "Assigned school not found" }, 404);
    }
  }

  // Use better-auth internal API to create user with password
  try {
    const created = await auth.api.signUpEmail({
      body: {
        name: body.name,
        email: body.email,
        password: body.password,
        role: body.role,
        schoolId: body.schoolId || undefined,
      },
    });

    return c.json({ success: true, data: created.user }, 201);
  } catch (err: any) {
    return c.json({ success: false, message: err.message || "Failed to create user" }, 400);
  }
});

// PUT /api/users/:id
usersRouter.put("/:id", zValidator("json", updateUserSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const now = new Date();

  const [existingUser] = await db.select().from(users).where(eq(users.id, id));
  if (!existingUser) {
    return c.json({ success: false, message: "User not found" }, 404);
  }

  const targetRole = body.role || existingUser.role;
  const targetSchoolId = body.schoolId !== undefined ? body.schoolId : existingUser.schoolId;

  if (targetRole === "branch_admin" && !targetSchoolId) {
    return c.json({ success: false, message: "Branch administrator must be assigned to a school" }, 400);
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      name: body.name !== undefined ? body.name : existingUser.name,
      role: targetRole,
      schoolId: targetSchoolId,
      updatedAt: now,
    })
    .where(eq(users.id, id))
    .returning();

  return c.json({ success: true, data: updatedUser });
});
