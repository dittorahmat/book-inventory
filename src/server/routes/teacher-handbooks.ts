import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db";
import { d1WriteErrorStatus } from "../lib/d1-write";
import { idSchema } from "../lib/validators";
import {
  isBookWarehouseStaffRole,
  isCentralRole,
  isSchoolRole,
} from "../../lib/staff-roles";
import { resolveRequestActor } from "../services/access-scope";
import {
  TeacherHandbookError,
  cancelTeacherHandbookOrder,
  createTeacherHandbookOrder,
  listTeacherHandbookOrders,
  updateTeacherHandbookOrder,
} from "../services/teacher-handbooks";

const allocationSchema = z.object({
  bookId: idSchema,
  teacherName: z.string().trim().min(1, "Nama guru wajib diisi"),
  gradeLevel: z.string().trim().optional().nullable(),
  rombel: z.string().trim().optional().nullable(),
  subject: z.string().trim().optional().nullable(),
  quantity: z.number().int().min(1, "Jumlah minimal 1"),
});

const createOrderSchema = z.object({
  schoolId: idSchema.optional(),
  notes: z.string().trim().optional().nullable(),
  allocations: z.array(allocationSchema).min(1, "Minimal 1 alokasi guru"),
});

const updateOrderSchema = z.object({
  notes: z.string().trim().optional().nullable(),
  allocations: z.array(allocationSchema).min(1, "Minimal 1 alokasi guru"),
});

export const teacherHandbooksRouter = new Hono();

teacherHandbooksRouter.get("/", async (c) => {
  const actor = await resolveRequestActor(c);
  if (!actor) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  const allowed = isSchoolRole(actor.role) || isCentralRole(actor.role) || isBookWarehouseStaffRole(actor.role);
  if (!allowed) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }

  const schoolId = isSchoolRole(actor.role)
    ? actor.schoolId ?? undefined
    : c.req.query("schoolId") || undefined;
  const status = c.req.query("status") || undefined;

  const data = await listTeacherHandbookOrders(db, { schoolId, status });
  return c.json({ success: true, data });
});

teacherHandbooksRouter.post("/", async (c) => {
  const actor = await resolveRequestActor(c);
  if (!actor) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  if (!isSchoolRole(actor.role) && !isCentralRole(actor.role)) {
    return c.json({ success: false, error: "Hanya staf cabang atau admin pusat yang dapat membuat pesanan." }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" }, 400);
  }

  const targetSchoolId = isSchoolRole(actor.role) ? actor.schoolId : parsed.data.schoolId;
  if (!targetSchoolId) {
    return c.json({ success: false, error: "Sekolah cabang wajib dipilih." }, 400);
  }

  try {
    const data = await createTeacherHandbookOrder(
      db,
      {
        schoolId: targetSchoolId,
        notes: parsed.data.notes,
        allocations: parsed.data.allocations,
      },
      null
    );
    return c.json({ success: true, data }, 201);
  } catch (err) {
    if (err instanceof TeacherHandbookError) {
      return c.json({ success: false, error: err.message }, err.statusCode as 400 | 403 | 404);
    }
    const d1Err = d1WriteErrorStatus(err, "Gagal membuat pesanan");
    if (d1Err) {
      return c.json({ success: false, error: d1Err.message }, d1Err.status);
    }
    return c.json({ success: false, error: err instanceof Error ? err.message : "Gagal membuat pesanan" }, 500);
  }
});

teacherHandbooksRouter.patch("/:id", async (c) => {
  const actor = await resolveRequestActor(c);
  if (!actor) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  if (!isSchoolRole(actor.role) && !isCentralRole(actor.role)) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }

  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" }, 400);
  }

  try {
    const schoolScope = isSchoolRole(actor.role) ? actor.schoolId : null;
    const data = await updateTeacherHandbookOrder(db, id, parsed.data, schoolScope);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof TeacherHandbookError) {
      return c.json({ success: false, error: err.message }, err.statusCode as 400 | 403 | 404);
    }
    const d1Err = d1WriteErrorStatus(err, "Gagal mengubah pesanan");
    if (d1Err) {
      return c.json({ success: false, error: d1Err.message }, d1Err.status);
    }
    return c.json({ success: false, error: err instanceof Error ? err.message : "Gagal mengubah pesanan" }, 500);
  }
});

teacherHandbooksRouter.post("/:id/cancel", async (c) => {
  const actor = await resolveRequestActor(c);
  if (!actor) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  if (!isSchoolRole(actor.role) && !isCentralRole(actor.role)) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }

  const id = c.req.param("id");
  try {
    const schoolScope = isSchoolRole(actor.role) ? actor.schoolId : null;
    const data = await cancelTeacherHandbookOrder(db, id, schoolScope);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof TeacherHandbookError) {
      return c.json({ success: false, error: err.message }, err.statusCode as 400 | 403 | 404);
    }
    return c.json({ success: false, error: err instanceof Error ? err.message : "Gagal membatalkan pesanan" }, 500);
  }
});
