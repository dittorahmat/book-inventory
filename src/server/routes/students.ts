import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db";
import { students, schools } from "../../db/schema";

export const studentsRouter = new Hono();

const upsertStudentSchema = z.object({
  id: z.string().min(1).optional(),
  schoolId: z.string().min(1, "Sekolah wajib dipilih"),
  nis: z.string().min(1, "NIS wajib diisi"),
  name: z.string().min(1, "Nama murid wajib diisi"),
  gender: z.enum(["male", "female"]).default("male"),
  gradeLevel: z.string().min(1, "Kelas wajib dipilih"),
  curriculumType: z.enum(["international", "national"]).default("international"),
  academicYear: z.string().min(1, "Tahun ajaran wajib diisi"),
  parentName: z.string().optional(),
  parentEmail: z.string().email("Format email orang tua tidak valid").optional().or(z.literal("")),
  parentPhone: z.string().optional(),
  status: z.enum(["active", "promoted", "new_pending", "rejected", "graduated"]).default("active"),
  isScholarship: z.boolean().default(false),
});

const updateStudentSchema = upsertStudentSchema.partial().omit({ id: true });

const verifyStudentSchema = z.object({
  action: z.enum(["approve", "reject"]),
  nis: z.string().min(1, "NIS resmi wajib diisi saat menyetujui").optional(),
});

async function nisTaken(nis: string, exceptId?: string) {
  const rows = await db.select({ id: students.id }).from(students).where(eq(students.nis, nis));
  return rows.some((r: { id: string }) => r.id !== exceptId);
}

// 1. GET list with school/status/search filters
studentsRouter.get("/", async (c) => {
  const schoolId = c.req.query("schoolId");
  const status = c.req.query("status");
  const search = c.req.query("search");

  const conditions = [];
  if (schoolId) conditions.push(eq(students.schoolId, schoolId));
  if (status && status !== "all") conditions.push(eq(students.status, status as any));

  const rows = await db
    .select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      gender: students.gender,
      gradeLevel: students.gradeLevel,
      curriculumType: students.curriculumType,
      academicYear: students.academicYear,
      parentName: students.parentName,
      parentEmail: students.parentEmail,
      parentPhone: students.parentPhone,
      status: students.status,
      isScholarship: students.isScholarship,
      schoolId: students.schoolId,
      schoolName: schools.name,
      createdAt: students.createdAt,
      updatedAt: students.updatedAt,
    })
    .from(students)
    .innerJoin(schools, eq(students.schoolId, schools.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(students.createdAt));

  const q = search?.trim().toLowerCase();
  const data = q
    ? rows.filter(
        (s: any) =>
          s.name.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q) ||
          (s.parentName || "").toLowerCase().includes(q)
      )
    : rows;

  return c.json({ success: true, data });
});

// 2. POST create (admin-side: langsung terverifikasi bila status active)
studentsRouter.post("/", zValidator("json", upsertStudentSchema), async (c) => {
  const body = c.req.valid("json");
  const now = new Date().toISOString();

  const [school] = await db.select().from(schools).where(eq(schools.id, body.schoolId));
  if (!school) {
    return c.json({ success: false, message: "Sekolah tidak ditemukan" }, 404);
  }
  if (await nisTaken(body.nis)) {
    return c.json({ success: false, message: "NIS sudah dipakai siswa lain" }, 400);
  }

  const id = body.id ?? crypto.randomUUID();
  await db.insert(students).values({
    id,
    schoolId: body.schoolId,
    nis: body.nis,
    name: body.name,
    gender: body.gender,
    gradeLevel: body.gradeLevel,
    curriculumType: body.curriculumType,
    academicYear: body.academicYear,
    parentName: body.parentName || null,
    parentEmail: body.parentEmail || null,
    parentPhone: body.parentPhone || null,
    status: body.status,
    isScholarship: body.isScholarship,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(students).where(eq(students.id, id));
  return c.json({ success: true, message: "Data siswa berhasil disimpan", data: created }, 201);
});

// 3. PUT update
studentsRouter.put("/:id", zValidator("json", updateStudentSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const now = new Date().toISOString();

  const [existing] = await db.select().from(students).where(eq(students.id, id));
  if (!existing) {
    return c.json({ success: false, message: "Data siswa tidak ditemukan" }, 404);
  }
  if (body.nis && body.nis !== existing.nis && (await nisTaken(body.nis, id))) {
    return c.json({ success: false, message: "NIS sudah dipakai siswa lain" }, 400);
  }
  if (body.schoolId) {
    const [school] = await db.select().from(schools).where(eq(schools.id, body.schoolId));
    if (!school) {
      return c.json({ success: false, message: "Sekolah tidak ditemukan" }, 404);
    }
  }

  const patch: Record<string, unknown> = { updatedAt: now };
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (key === "parentEmail" && value === "") patch[key] = null;
    else if (key === "isScholarship") patch[key] = value;
    else patch[key] = value;
  }

  await db.update(students).set(patch as any).where(eq(students.id, id));
  const [updated] = await db.select().from(students).where(eq(students.id, id));
  return c.json({ success: true, message: "Data siswa berhasil diperbarui", data: updated });
});

// 4. DELETE remove
studentsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [existing] = await db.select().from(students).where(eq(students.id, id));
  if (!existing) {
    return c.json({ success: false, message: "Data siswa tidak ditemukan" }, 404);
  }
  await db.delete(students).where(eq(students.id, id));
  return c.json({ success: true, message: "Data siswa berhasil dihapus" });
});

// 5. POST verify (approve dengan NIS resmi / reject)
studentsRouter.post("/:id/verify", zValidator("json", verifyStudentSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const now = new Date().toISOString();

  const [existing] = await db.select().from(students).where(eq(students.id, id));
  if (!existing) {
    return c.json({ success: false, message: "Data siswa tidak ditemukan" }, 404);
  }

  if (body.action === "approve") {
    if (!body.nis) {
      return c.json({ success: false, message: "NIS resmi wajib diisi saat menyetujui" }, 400);
    }
    if (body.nis !== existing.nis && (await nisTaken(body.nis, id))) {
      return c.json({ success: false, message: "NIS sudah dipakai siswa lain" }, 400);
    }
    await db
      .update(students)
      .set({ nis: body.nis, status: "active", updatedAt: now })
      .where(eq(students.id, id));
    const [updated] = await db.select().from(students).where(eq(students.id, id));
    return c.json({ success: true, message: "Siswa disetujui dan aktif", data: updated });
  }

  await db.update(students).set({ status: "rejected", updatedAt: now }).where(eq(students.id, id));
  const [updated] = await db.select().from(students).where(eq(students.id, id));
  return c.json({ success: true, message: "Pendaftaran siswa ditolak", data: updated });
});
