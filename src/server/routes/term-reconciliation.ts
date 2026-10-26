import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  termReconciliationItems,
  termReconciliations,
} from "../../db/schema";
import { idSchema } from "../lib/validators";
import {
  accessErrorResponse,
  assertLocationAllowed,
  requireScopedActor,
} from "../services/access-scope";
import {
  compileTermAuditData,
  finalizeTermReconciliation,
  getStudentHandoverRecap,
  saveTermReconciliation,
} from "../services/term-reconciliation";

export const termReconciliationRouter = new Hono();

const compileAuditSchema = z.object({
  schoolId: idSchema,
  academicYear: z.string().min(1, "Tahun ajaran wajib diisi"),
  term: z.string().min(1, "Semester/Term wajib diisi"),
});

const saveReconciliationSchema = z.object({
  schoolId: idSchema,
  academicYear: z.string().min(1, "Tahun ajaran wajib diisi"),
  term: z.string().min(1, "Semester/Term wajib diisi"),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      itemType: z.enum(["package", "book"]).default("package"),
      packageId: idSchema.optional(),
      bookId: idSchema.optional(),
      totalInbound: z.number().int().min(0).optional(),
      totalDistributed: z.number().int().min(0).optional(),
      physicalRemaining: z.number().int().min(0),
      unitPrice: z.number().int().min(0).optional(),
      notes: z.string().optional(),
    })
  ).min(1, "Minimal 1 item rekonsiliasi"),
});

// 1. GET compile audit data untuk cabang dan tahun ajaran tertentu
termReconciliationRouter.get("/compile", zValidator("query", compileAuditSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const { schoolId, academicYear, term } = c.req.valid("query");
    assertLocationAllowed(actor, schoolId, locations);

    const data = await compileTermAuditData(db, { schoolId, academicYear, term });
    return c.json({ success: true, data });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 2. GET list riwayat dokumen rekonsiliasi cabang
termReconciliationRouter.get("/list", async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const schoolId = c.req.query("schoolId");
    if (schoolId) {
      assertLocationAllowed(actor, schoolId, locations);
    }

    const query = db
      .select()
      .from(termReconciliations)
      .orderBy(desc(termReconciliations.createdAt))
      .limit(50);

    const rows = schoolId ? await query.where(eq(termReconciliations.schoolId, schoolId)) : await query;
    return c.json({ success: true, data: rows });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 3. GET detail rekonsiliasi beserta items
termReconciliationRouter.get("/:id", async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const id = c.req.param("id");

    const [recon] = await db
      .select()
      .from(termReconciliations)
      .where(eq(termReconciliations.id, id));

    if (!recon) {
      return c.json({ success: false, message: "Dokumen rekonsiliasi tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, recon.schoolId, locations);

    const items = await db
      .select()
      .from(termReconciliationItems)
      .where(eq(termReconciliationItems.reconciliationId, id));

    return c.json({ success: true, data: { ...recon, items } });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 4. POST simpan dokumen rekonsiliasi (draft)
termReconciliationRouter.post("/", zValidator("json", saveReconciliationSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const body = c.req.valid("json");
    assertLocationAllowed(actor, body.schoolId, locations);

    const result = await saveTermReconciliation(db, {
      ...body,
      createdByUserId: actor?.schoolId || undefined,
    });
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status as 400);
    }

    return c.json({
      success: true,
      message: "Berita Acara Rekonsiliasi berhasil disimpan",
      data: result.data,
    }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 5. POST finalisasi dokumen rekonsiliasi
termReconciliationRouter.post("/:id/finalize", async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const id = c.req.param("id");

    const [recon] = await db
      .select()
      .from(termReconciliations)
      .where(eq(termReconciliations.id, id));

    if (!recon) {
      return c.json({ success: false, message: "Dokumen rekonsiliasi tidak ditemukan" }, 404);
    }
    assertLocationAllowed(actor, recon.schoolId, locations);

    const result = await finalizeTermReconciliation(db, id);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status as 400);
    }

    return c.json({
      success: true,
      message: "Dokumen rekonsiliasi berhasil difinalisasi",
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 6. GET rekapitulasi data serah terima siswa untuk lampiran penagihan
termReconciliationRouter.get("/recap/:schoolId", async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const schoolId = c.req.param("schoolId");
    assertLocationAllowed(actor, schoolId, locations);

    const recap = await getStudentHandoverRecap(db, schoolId);
    return c.json({ success: true, data: recap });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
