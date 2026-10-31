import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  students,
  uniformOrders,
  uniformOrderItems,
  uniformRefunds,
} from "../../db/schema";
import { d1WriteErrorStatus, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";
import { documentNumber, epochTimeFragment, randomSerial } from "../lib/document-number";
import { defaultStorage, type StorageService } from "../../services/storage";
import { findRefundSlip, refundSlipInsertQuery } from "./refund-slip";
import {
  BOOK_RETURN_MAX_PHOTO_BYTES,
  BOOK_RETURN_PHOTO_DATA_URL,
  detectImageMime,
} from "../../lib/book-return";
import { adjustPackageStockQuery, adjustVariantStockQuery } from "./uniform/stock";

export interface RequestUniformWithdrawalInput {
  orderId: string;
  studentId: string;
  reason: string;
  courierResi: string;
  letterProofBase64?: string;
}

export interface UniformWithdrawalDeps extends WriteDeps {
  storage?: StorageService;
  generateSlipNumber?: (now: string) => string;
}

export async function requestUniformWithdrawal(
  database: AppDatabase,
  input: RequestUniformWithdrawalInput,
  deps: UniformWithdrawalDeps = {}
): Promise<
  | { ok: true; orderId: string; orderNumber: string; refundId: string }
  | { ok: false; status: 400 | 404 | 409 | 500; message: string }
> {
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
  const fullReason = `[PENGUNDURAN DIRI] ${input.reason.trim()}`;

  try {
    await database.insert(uniformRefunds).values({
      id,
      refundNumber,
      orderId: order.id,
      studentId: order.studentId,
      amount: order.paidAmount > 0 ? order.paidAmount : order.totalAmount,
      reason: fullReason,
      courierResi: input.courierResi.trim(),
      letterProofUrl,
      status: "requested",
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pengajuan pembatalan seragam");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    refundId: id,
  };
}

export async function approveUniformWithdrawal(
  database: AppDatabase,
  refundId: string,
  actorUserId?: string,
  deps: UniformWithdrawalDeps = {}
): Promise<
  | { ok: true; slip: NonNullable<Awaited<ReturnType<typeof findRefundSlip>>>; message: string }
  | { ok: false; status: 400 | 404 | 409 | 500; message: string }
> {
  const now = writeNow(deps);
  const [rf] = await database.select().from(uniformRefunds).where(eq(uniformRefunds.id, refundId));
  if (!rf) {
    return { ok: false, status: 404, message: "Pengajuan refund seragam tidak ditemukan" };
  }

  const [order] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, rf.orderId));
  if (!order) {
    return { ok: false, status: 404, message: "Order seragam terkait tidak ditemukan" };
  }

  const [student] = await database.select().from(students).where(eq(students.id, order.studentId));

  const generateSlip =
    deps.generateSlipNumber ??
    (() => documentNumber("RET-U", epochTimeFragment(Date.now(), 6), randomSerial(6)));
  const slipNumber = generateSlip(now);
  const courierResi = rf.courierResi?.trim() || "-";

  // 1. Restock fisik seragam yang diterima kembali ke Gudang Pusat
  const items = await database.select().from(uniformOrderItems).where(eq(uniformOrderItems.orderId, order.id));
  for (const item of items) {
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

  // 2. Tandai uniformRefunds approved + terbitkan Slip Bukti Pengembalian.
  const writeOps = [
    database
      .update(uniformRefunds)
      .set({
        status: "approved",
        handledByUserId: actorUserId ?? null,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(uniformRefunds.id, refundId)),
    refundSlipInsertQuery(database, {
      kind: "seragam",
      slipNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      studentId: order.studentId,
      studentName: student?.name ?? "Siswa",
      nis: student?.nis ?? "-",
      schoolId: order.schoolId,
      refundAmount: rf.amount,
      courierResi,
      letterProofUrl: rf.letterProofUrl,
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
  if (!slip) {
    return { ok: false, status: 500, message: "Slip pengembalian gagal dibaca setelah disimpan." };
  }
  return {
    ok: true,
    slip,
    message: `Fisik seragam retur berhasil diterima & dimasukkan ke stok gudang pusat. Slip ${slipNumber} diterbitkan untuk Finance.`,
  };
}
