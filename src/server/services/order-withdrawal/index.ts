import { eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../../db";
import {
  bookReturns,
  packageItems,
  studentBookOrders,
  students,
  uniformOrders,
  uniformOrderItems,
  uniformRefunds,
} from "../../../db/schema";
import { d1WriteErrorStatus, runWriteBatch, writeNow, type WriteDeps } from "../../lib/d1-write";
import { documentNumber, epochTimeFragment, randomSerial } from "../../lib/document-number";
import { defaultStorage, type StorageService } from "../../../services/storage";
import { findRefundSlip, refundSlipInsertQuery } from "../refund-slip";
import { reportReturn } from "../return";
import {
  BOOK_RETURN_MAX_PHOTO_BYTES,
  BOOK_RETURN_PHOTO_DATA_URL,
  detectImageMime,
} from "../../../lib/book-return";
import { adjustPackageStockQuery, adjustVariantStockQuery } from "../uniform/stock";

export type WithdrawalKind = "buku" | "seragam";

export interface RequestWithdrawalInput {
  kind: WithdrawalKind;
  orderId: string;
  studentId: string;
  reason: string;
  letterProofBase64?: string;
  courierResi?: string;
}

export interface WithdrawalDeps extends WriteDeps {
  storage?: StorageService;
  generateSlipNumber?: (now: string) => string;
}

export interface WithdrawalSuccess {
  ok: true;
  kind: WithdrawalKind;
  orderId: string;
  orderNumber: string;
  status?: string;
  returnId?: string;
  refundId?: string;
}

export interface WithdrawalFailure {
  ok: false;
  status: ContentfulStatusCode;
  message: string;
}

export type WithdrawalResult = WithdrawalSuccess | WithdrawalFailure;

/**
 * Deep Module: Titik masuk pengajuan pembatalan akibat murid mengundurkan diri (ADR-0019).
 * Mengenkapsulasi validasi dokumen, pembuatan entitas retur/refund, dan penyerahan bukti.
 */
export async function submitStudentWithdrawal(
  database: AppDatabase,
  input: RequestWithdrawalInput,
  deps: WithdrawalDeps = {}
): Promise<WithdrawalResult> {
  const trimmedReason = input.reason?.trim() ?? "";
  if (trimmedReason.length < 5) {
    return {
      ok: false,
      status: 400,
      message: "Alasan pengunduran diri minimal 5 karakter",
    };
  }

  const [student] = await database
    .select({ id: students.id })
    .from(students)
    .where(eq(students.id, input.studentId));

  if (!student) {
    return {
      ok: false,
      status: 404,
      message: "Data murid tidak ditemukan",
    };
  }

  if (input.kind === "buku") {
    const result = await reportReturn(
      database,
      {
        orderId: input.orderId,
        studentId: input.studentId,
        kind: "withdrawal",
        reason: trimmedReason,
        photoProofBase64: input.letterProofBase64,
        source: "public",
      },
      { storage: deps.storage, generateId: deps.generateId, now: deps.now ? () => deps.now as string : undefined }
    );
    if (!result.ok) return result;
    return {
      ok: true,
      kind: "buku",
      orderId: result.created.orderId,
      orderNumber: result.orderNumber,
      returnId: result.created.id,
      status: "return_in_progress",
    };
  }

  // Uniform withdrawal
  const [order] = await database
    .select()
    .from(uniformOrders)
    .where(eq(uniformOrders.id, input.orderId));

  if (!order) {
    return { ok: false, status: 404, message: "Pesanan seragam tidak ditemukan" };
  }
  if (order.studentId !== input.studentId) {
    return { ok: false, status: 400, message: "Pesanan seragam tidak sesuai dengan data siswa" };
  }
  if (!input.courierResi || input.courierResi.trim().length < 3) {
    return { ok: false, status: 400, message: "Nomor resi kurir pengembalian fisik seragam wajib diisi" };
  }

  const now = writeNow(deps);
  const store: StorageService = deps.storage ?? defaultStorage;
  let letterProofUrl: string | null = null;

  if (input.letterProofBase64) {
    const trimmed = input.letterProofBase64.trim();
    if (!BOOK_RETURN_PHOTO_DATA_URL.test(trimmed)) {
      return { ok: false, status: 400, message: "Format dokumen surat harus JPG, PNG, atau WebP" };
    }
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return { ok: false, status: 400, message: "Format base64 dokumen tidak valid" };
    }
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > BOOK_RETURN_MAX_PHOTO_BYTES) {
      return { ok: false, status: 400, message: "Ukuran dokumen surat melebihi batas 2 MB" };
    }
    const mime = detectImageMime(buffer);
    if (!mime) {
      return { ok: false, status: 400, message: "Berkas bukan gambar yang valid" };
    }
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
    const letterKey = `withdrawals/uniforms/${order.id}-${Date.now()}.${ext}`;
    letterProofUrl = await store.upload(letterKey, buffer, mime);
  }

  const id = `rf-wdr-${deps.generateId?.() ?? Date.now()}`;
  const refundNumber = documentNumber("RFD-U", now.slice(0, 10).replaceAll("-", ""), randomSerial(6));

  try {
    await database.insert(uniformRefunds).values({
      id,
      refundNumber,
      orderId: order.id,
      studentId: order.studentId,
      amount: order.paidAmount > 0 ? order.paidAmount : order.totalAmount,
      kind: "withdrawal",
      reason: trimmedReason,
      courierResi: input.courierResi.trim(),
      letterProofUrl,
      status: "requested",
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pengajuan refund seragam");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    kind: "seragam",
    orderId: order.id,
    orderNumber: order.orderNumber,
    refundId: id,
  };
}

/**
 * Deep Module: Penyelesaian persetujuan pengunduran diri siswa oleh gudang (ADR-0019).
 * Melepas alokasi fisik barang menjadi stok bebas, menerbitkan slip resmi (RET-B/RET-U),
 * dan memasukkan pencatatan ke antrean refund Finance secara atomik.
 */
export async function approveStudentWithdrawal(
  database: AppDatabase,
  target: { kind: "buku"; returnId: string } | { kind: "seragam"; refundId: string },
  actorUserId?: string,
  deps: WithdrawalDeps = {}
): Promise<
  | { ok: true; slip: NonNullable<Awaited<ReturnType<typeof findRefundSlip>>>; message: string }
  | { ok: false; status: 400 | 404 | 409 | 500; message: string }
> {
  const now = writeNow(deps);

  if (target.kind === "buku") {
    const [ret] = await database.select().from(bookReturns).where(eq(bookReturns.id, target.returnId));
    if (!ret) return { ok: false, status: 404, message: "Laporan pembatalan retur tidak ditemukan" };
    if (ret.kind !== "withdrawal") {
      return { ok: false, status: 400, message: "Laporan ini bukan pengajuan pengunduran diri." };
    }

    const [order] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, ret.orderId));
    if (!order) return { ok: false, status: 404, message: "Pesanan tidak ditemukan" };

    const [student] = await database.select().from(students).where(eq(students.id, order.studentId));
    const generateSlip =
      deps.generateSlipNumber ??
      (() => documentNumber("RET-B", epochTimeFragment(Date.now(), 6), randomSerial(6)));
    const slipNumber = generateSlip(now);
    const refundAmount = order.paidAmount > 0 ? order.paidAmount : order.totalAmount;

    const writeOps = [];
    if (order.assignedPackageItemId) {
      writeOps.push(
        database
          .update(packageItems)
          .set({ status: "in_stock", updatedAt: now })
          .where(eq(packageItems.id, order.assignedPackageItemId))
      );
    }
    writeOps.push(
      database
        .update(studentBookOrders)
        .set({ fulfillmentStatus: "return_in_progress", assignedPackageItemId: null, updatedAt: now })
        .where(eq(studentBookOrders.id, order.id))
    );
    writeOps.push(
      database
        .update(bookReturns)
        .set({ status: "approved", resolvedAt: now, handledByUserId: actorUserId || null, updatedAt: now })
        .where(eq(bookReturns.id, ret.id))
    );
    writeOps.push(
      refundSlipInsertQuery(database, {
        slipNumber,
        kind: "buku",
        orderId: order.id,
        orderNumber: order.orderNumber,
        studentId: order.studentId,
        studentName: student?.name || "Murid",
        nis: student?.nis || "-",
        schoolId: order.schoolId,
        refundAmount,
        sourceId: ret.id,
        letterProofUrl: ret.photoProofUrl,
        approvedAt: now,
      })
    );

    try {
      await runWriteBatch(database, writeOps);
    } catch (err) {
      const mapped = d1WriteErrorStatus(err, "persetujuan pembatalan buku");
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }

    const slip = await findRefundSlip(database, slipNumber);
    if (!slip) return { ok: false, status: 500, message: "Gagal membuat slip pengembalian barang resmi" };
    return { ok: true, slip, message: `Persetujuan berhasil. Slip resmi diterbitkan: ${slipNumber}` };
  }

  // Uniform approval
  const [refund] = await database.select().from(uniformRefunds).where(eq(uniformRefunds.id, target.refundId));
  if (!refund) return { ok: false, status: 404, message: "Pengajuan refund seragam tidak ditemukan" };
  if (refund.status === "approved" || refund.status === "refunded") {
    return { ok: false, status: 400, message: "Pengajuan pengembalian ini sudah disetujui sebelumnya" };
  }

  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, refund.orderId));
  if (!order) return { ok: false, status: 404, message: "Pesanan seragam tidak ditemukan" };

  const [student] = await database.select().from(students).where(eq(students.id, refund.studentId));
  const generateSlip =
    deps.generateSlipNumber ??
    (() => documentNumber("RET-U", epochTimeFragment(Date.now(), 6), randomSerial(6)));
  const slipNumber = generateSlip(now);

  const orderItems = await database.select().from(uniformOrderItems).where(eq(uniformOrderItems.orderId, order.id));
  for (const item of orderItems) {
    if (item.variantId) {
      await adjustVariantStockQuery(
        database,
        { variantId: item.variantId, size: item.size, delta: item.quantity },
        "create",
        { now }
      );
    } else if (item.packageId) {
      await adjustPackageStockQuery(
        database,
        { packageId: item.packageId, delta: item.quantity },
        "create",
        { now }
      );
    }
  }

  const writeOps = [
    database
      .update(uniformRefunds)
      .set({ status: "approved", handledByUserId: actorUserId ?? null, resolvedAt: now, updatedAt: now })
      .where(eq(uniformRefunds.id, refund.id)),
    refundSlipInsertQuery(database, {
      slipNumber,
      kind: "seragam",
      orderId: order.id,
      orderNumber: order.orderNumber,
      studentId: order.studentId,
      studentName: student?.name || "Murid",
      nis: student?.nis || "-",
      schoolId: order.schoolId,
      refundAmount: refund.amount,
      sourceId: refund.id,
      courierResi: refund.courierResi,
      letterProofUrl: refund.letterProofUrl,
      approvedAt: now,
    }),
  ];

  try {
    await runWriteBatch(database, writeOps);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "persetujuan pembatalan seragam");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  const slip = await findRefundSlip(database, slipNumber);
  if (!slip) return { ok: false, status: 500, message: "Gagal membuat slip pengembalian seragam resmi" };
  return { ok: true, slip, message: `Persetujuan berhasil. Slip resmi diterbitkan: ${slipNumber}` };
}
