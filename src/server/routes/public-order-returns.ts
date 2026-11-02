import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../../db";
import { idSchema, base64UploadSchema } from "../lib/validators";
import { BOOK_RETURN_MAX_PHOTO_BASE64_CHARS, BOOK_RETURN_PHOTO_DATA_URL } from "../../lib/book-return";
import { reportReturn } from "../services/return";
import { requestStudentWithdrawal } from "../services/student-withdrawal";

export const publicOrderReturnsRouter = new Hono();

// Pengajuan refund buku oleh orang tua (tanpa login).
const publicReturnSchema = z.object({
  orderId: idSchema,
  studentId: idSchema,
  defectiveBookId: idSchema,
  reason: z.string().min(5, "Alasan / deskripsi kerusakan minimal 5 karakter"),
  photoProofBase64: z
    .string()
    .regex(BOOK_RETURN_PHOTO_DATA_URL, "Foto bukti harus berupa gambar JPG/PNG/WebP.")
    .max(BOOK_RETURN_MAX_PHOTO_BASE64_CHARS, "Ukuran foto melebihi batas 2 MB"),
}).strict();

publicOrderReturnsRouter.post("/submit-return", zValidator("json", publicReturnSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await reportReturn(db, { ...body, source: "public" });
  if (!result.ok) {
    return c.json({ success: false, message: result.message }, result.status);
  }

  return c.json(
    {
      success: true,
      message:
        "Pengajuan refund buku berhasil dikirim. Tim logistik gudang akan memverifikasi kondisi fisik buku Anda.",
      data: {
        returnId: result.created.id,
        orderNumber: result.orderNumber,
        status: result.created.status,
      },
    },
    201
  );
});

// Pengajuan pembatalan buku oleh siswa mengundurkan diri (ADR-0019)
const cancelWithdrawalSchema = z.object({
  orderId: idSchema,
  studentId: idSchema,
  reason: z.string().min(5, "Alasan pengunduran diri minimal 5 karakter"),
  letterProofBase64: base64UploadSchema,
}).strict();

publicOrderReturnsRouter.post("/cancel-withdrawal", zValidator("json", cancelWithdrawalSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await requestStudentWithdrawal(db, {
    kind: "buku",
    orderId: body.orderId,
    studentId: body.studentId,
    reason: body.reason,
    letterProofBase64: body.letterProofBase64,
  });
  if (!result.ok) {
    return c.json({ success: false, message: result.message }, result.status);
  }

  return c.json(
    {
      success: true,
      message: "Pengajuan pembatalan buku siswa mengundurkan diri berhasil dikirim untuk review gudang.",
      data: result,
    },
    201
  );
});
