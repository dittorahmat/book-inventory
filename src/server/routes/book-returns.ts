import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  studentBookOrders,
  students,
  bookReturns,
  books,
  schools,
} from "../../db/schema";
import { reportReturn, resolveReturn } from "../services/return";
import { approveBookWithdrawal } from "../services/book-withdrawal";
import { findRefundSlip } from "../services/refund-slip";
import {
  accessErrorResponse,
  assertLocationAllowed,
  loadScopedOrder,
  requireScopedActor,
} from "../services/access-scope";
import { matchAnyLower } from "../lib/partitioned-search";
import { idSchema } from "../lib/validators";

export const bookReturnsRouter = new Hono();

const VALID_RETURN_STATUSES = ["reported", "approved", "replaced", "rejected", "refunded"] as const;
type ReturnStatus = (typeof VALID_RETURN_STATUSES)[number];

const returnBookSchema = z.object({
  orderId: idSchema,
  studentId: idSchema,
  defectiveBookId: idSchema,
  reason: z.string().min(1, "Reason is required"),
  photoProofBase64: z.string().optional(),
});

const resolveReturnSchema = z.object({
  action: z.enum(["replace", "reject", "refund"]),
  replacementBookItemId: idSchema.optional(),
  refundAmount: z.number().int().min(0).optional(),
  handledByUserId: idSchema.optional(),
});

// 1. POST Report Defective Book for Return/Refund
bookReturnsRouter.post("/", zValidator("json", returnBookSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const body = c.req.valid("json");
    const scoped = await loadScopedOrder(db, actor, locations, body.orderId);
    if (!scoped.ok) {
      return c.json({ success: false, message: scoped.message }, scoped.status);
    }
    const result = await reportReturn(db, { ...body, source: "staff" });
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    return c.json({ success: true, message: "Laporan retur/refund buku berhasil disimpan", data: result.created }, 201);
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 2. GET all book returns
bookReturnsRouter.get("/", async (c) => {
  try {
    const { scope, locations } = await requireScopedActor(db, c);
    const scopedOnly = scope.length < locations.length;
    const returnStatus = c.req.query("status");
    const returnSearch = c.req.query("search")?.trim().toLowerCase();

    const returnConditions = [];
    if (scopedOnly) returnConditions.push(inArray(studentBookOrders.schoolId, scope));
    if (returnStatus && returnStatus !== "all" && VALID_RETURN_STATUSES.includes(returnStatus as ReturnStatus)) {
      returnConditions.push(eq(bookReturns.status, returnStatus as ReturnStatus));
    }
    if (returnSearch) {
      const matched = matchAnyLower([students.name, students.nis, studentBookOrders.orderNumber, books.title], returnSearch);
      if (matched) returnConditions.push(matched);
    }

    const visible = await db
      .select({
        id: bookReturns.id,
        orderId: bookReturns.orderId,
        orderNumber: studentBookOrders.orderNumber,
        studentId: bookReturns.studentId,
        studentName: students.name,
        nis: students.nis,
        orderSchoolId: studentBookOrders.schoolId,
        defectiveBookId: bookReturns.defectiveBookId,
        bookTitle: books.title,
        isbn: books.isbn,
        reason: bookReturns.reason,
        photoProofUrl: bookReturns.photoProofUrl,
        status: bookReturns.status,
        replacementBookItemId: bookReturns.replacementBookItemId,
        resolvedAt: bookReturns.resolvedAt,
        createdAt: bookReturns.createdAt,
      })
      .from(bookReturns)
      .innerJoin(studentBookOrders, eq(bookReturns.orderId, studentBookOrders.id))
      .innerJoin(students, eq(bookReturns.studentId, students.id))
      .innerJoin(books, eq(bookReturns.defectiveBookId, books.id))
      .where(returnConditions.length > 0 ? and(...returnConditions) : undefined)
      .orderBy(desc(bookReturns.createdAt))
      .limit(50);

    return c.json({ success: true, data: visible });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 3. GET export approved refunds to CSV
bookReturnsRouter.get("/export", async (c) => {
  try {
    const { scope, locations } = await requireScopedActor(db, c);
    const schoolId = c.req.query("schoolId");
    const status = c.req.query("status") || "approved";

    const conditions = [];
    if (scope && scope.length > 0) conditions.push(inArray(studentBookOrders.schoolId, scope));
    if (schoolId) {
      assertLocationAllowed({ role: "central_admin", schoolId: null }, schoolId, locations);
      conditions.push(eq(studentBookOrders.schoolId, schoolId));
    }
    if (status && status !== "all" && VALID_RETURN_STATUSES.includes(status as ReturnStatus)) {
      conditions.push(eq(bookReturns.status, status as ReturnStatus));
    }

    const rows = await db
      .select({
        id: bookReturns.id,
        orderNumber: studentBookOrders.orderNumber,
        schoolName: schools.name,
        studentName: students.name,
        nis: students.nis,
        gradeLevel: students.gradeLevel,
        bookTitle: books.title,
        isbn: books.isbn,
        refundAmount: bookReturns.refundAmount,
        reason: bookReturns.reason,
        status: bookReturns.status,
        createdAt: bookReturns.createdAt,
        resolvedAt: bookReturns.resolvedAt,
      })
      .from(bookReturns)
      .innerJoin(studentBookOrders, eq(bookReturns.orderId, studentBookOrders.id))
      .innerJoin(schools, eq(studentBookOrders.schoolId, schools.id))
      .innerJoin(students, eq(bookReturns.studentId, students.id))
      .innerJoin(books, eq(bookReturns.defectiveBookId, books.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bookReturns.createdAt));

    const csvHeaders = "ID,No Order,Sekolah,Nama Siswa,NIS,Jenjang/Kelas,Judul Buku,ISBN,Nominal Refund,Alasan,Status,Tgl Pengajuan,Tgl Selesai\n";
    const csvRows = rows.map((r) =>
      [
        `"${r.id}"`,
        `"${r.orderNumber}"`,
        `"${r.schoolName}"`,
        `"${r.studentName}"`,
        `"${r.nis}"`,
        `"${r.gradeLevel}"`,
        `"${r.bookTitle}"`,
        `"${r.isbn || "-"}"`,
        r.refundAmount || 0,
        `"${(r.reason || "").replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${r.createdAt}"`,
        `"${r.resolvedAt || "-"}"`,
      ].join(",")
    );

    return new Response(csvHeaders + csvRows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="rekap-refund-buku.csv"',
      },
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 4. POST Resolve Book Return / Refund
bookReturnsRouter.post("/:id/resolve", zValidator("json", resolveReturnSchema), async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const returnId = c.req.param("id");
    const body = c.req.valid("json");

    const [ret] = await db.select().from(bookReturns).where(eq(bookReturns.id, returnId));
    if (!ret) {
      return c.json({ success: false, message: "Laporan retur tidak ditemukan" }, 404);
    }
    const scoped = await loadScopedOrder(db, actor, locations, ret.orderId);
    if (!scoped.ok) {
      return c.json({ success: false, message: scoped.message }, scoped.status);
    }

    const result = await resolveReturn(db, returnId, body);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 5. POST Approve Book Withdrawal & Auto Unassign Stock (ADR-0019)
bookReturnsRouter.post("/:id/approve-withdrawal", async (c) => {
  try {
    const { actor, locations } = await requireScopedActor(db, c);
    const returnId = c.req.param("id");

    const [ret] = await db.select().from(bookReturns).where(eq(bookReturns.id, returnId));
    if (!ret) {
      return c.json({ success: false, message: "Laporan retur tidak ditemukan" }, 404);
    }
    const scoped = await loadScopedOrder(db, actor, locations, ret.orderId);
    if (!scoped.ok) {
      return c.json({ success: false, message: scoped.message }, scoped.status);
    }

    const result = await approveBookWithdrawal(db, returnId);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }

    return c.json({
      success: true,
      message: result.message,
      data: result.slip,
    });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});

// 6. GET Book Withdrawal Slip details
bookReturnsRouter.get("/withdrawal-slip/:slipNumber", async (c) => {
  try {
    await requireScopedActor(db, c);
    const slipNumber = c.req.param("slipNumber");
    const slip = await findRefundSlip(db, slipNumber);
    if (!slip) {
      return c.json({ success: false, message: "Slip bukti pengembalian buku tidak ditemukan" }, 404);
    }
    return c.json({ success: true, data: slip });
  } catch (err) {
    return accessErrorResponse(c, err);
  }
});
