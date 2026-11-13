import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { schools } from "../../db/schema";
import {
  requireScopedActor,
  assertLocationAllowed,
  accessErrorResponse,
} from "../services/access-scope";
import {
  importStudents,
  batchPromoteStudents,
} from "../services/student-lifecycle";
import { idSchema } from "../lib/validators";
import { parseStudentData } from "../../lib/student-import-parser";
import { fetchGoogleDriveResource } from "../services/drive-service";

export const studentsBulkRouter = new Hono();

const parseDriveUrlPayloadSchema = z
  .object({
    url: z.string().url("URL tidak valid"),
  })
  .strict();

/**
 * Endpoint server-side untuk parsing Google Drive Folder atau Google Sheets URL murid.
 * Mencegah CORS browser dan mengekstrak file spreadsheet atau CSV data murid.
 */
studentsBulkRouter.post("/parse-drive-url", zValidator("json", parseDriveUrlPayloadSchema), async (c) => {
  try {
    const { actor } = await requireScopedActor(db, c);
    if (!actor) {
      return c.json({ success: false, message: "Akses ditolak." }, 403);
    }

    const { url } = c.req.valid("json");
    const res = await fetchGoogleDriveResource(url);

    if (!res.success) {
      return c.json({ success: false, message: res.message }, res.status);
    }

    if (res.type === "folder") {
      return c.json({
        success: true,
        type: "folder",
        data: res.data,
      });
    }

    const payload = res.data.buffer ?? res.data.csvText ?? "";
    const parseResult = parseStudentData(payload);
    return c.json({
      success: true,
      type: "sheet",
      data: parseResult,
    });
  } catch (err: unknown) {
    return accessErrorResponse(c, err);
  }
});

// POST bulk-import (upsert based on schoolId + nis)
const bulkImportItemSchema = z.object({
  nis: z.string().min(1, "NIS wajib diisi"),
  name: z.string().min(1, "Nama wajib diisi"),
  gradeLevel: z.string().min(1, "Kelas wajib diisi"),
  rombel: z.string().trim().optional().nullable(),
  gender: z.enum(["male", "female"]).default("male"),
  curriculumType: z.enum(["international", "national"]).default("international"),
  academicYear: z.string().min(1).default("2026/2027"),
  parentName: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal("")),
  parentPhone: z.string().optional(),
  status: z.enum(["active", "promoted", "new_pending", "rejected", "graduated"]).default("active"),
  isScholarship: z.boolean().default(false),
});

const bulkImportPayloadSchema = z.object({
  schoolId: z.string().min(1, "Sekolah wajib dipilih"),
  students: z.array(bulkImportItemSchema).min(1, "Minimal 1 data siswa untuk diimpor"),
});

studentsBulkRouter.post("/bulk-import", zValidator("json", bulkImportPayloadSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const body = c.req.valid("json");
    assertLocationAllowed(actor, body.schoolId, locations);

    const [school] = await db.select().from(schools).where(eq(schools.id, body.schoolId));
    if (!school) {
      return c.json({ success: false, message: "Sekolah tidak ditemukan" }, 404);
    }

    const imported = await importStudents(db, body.schoolId, body.students);
    if (!imported.ok) {
      return c.json({ success: false, message: imported.message }, imported.status);
    }

    return c.json({
      success: true,
      message: `Impor berhasil: ${imported.data.insertedCount} siswa baru ditambahkan, ${imported.data.updatedCount} siswa diperbarui.`,
      data: imported.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// POST batch-promote (promosi kenaikan kelas masal per sekolah)
const batchPromoteSchema = z.object({
  schoolId: idSchema,
  targetAcademicYear: z.string().min(1, "Tahun ajaran baru wajib diisi"),
  excludeStudentIds: z.array(idSchema).default([]),
  maxGradeLevel: z.number().int().min(1).default(6),
});

studentsBulkRouter.post("/batch-promote", zValidator("json", batchPromoteSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const body = c.req.valid("json");
    assertLocationAllowed(actor, body.schoolId, locations);

    const result = await batchPromoteStudents(db, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({
      success: true,
      message: `Promosi kelas berhasil: ${result.data.promotedCount} naik kelas, ${result.data.graduatedCount} lulus/alumni, ${result.data.skippedCount} dilewati/tinggal kelas.`,
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

