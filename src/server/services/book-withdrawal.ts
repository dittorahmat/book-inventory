import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  bookPackageItems,
  bookReturns,
  packageItems,
  studentBookOrders,
  studentOrderItems,
  students,
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

export interface RequestBookWithdrawalInput {
  orderId: string;
  studentId: string;
  reason: string;
  letterProofBase64?: string;
}

export interface BookWithdrawalDeps extends WriteDeps {
  storage?: StorageService;
  generateSlipNumber?: (now: string) => string;
}

export async function requestBookWithdrawal(
  database: AppDatabase,
  input: RequestBookWithdrawalInput,
  deps: BookWithdrawalDeps = {}
): Promise<
  | { ok: true; orderId: string; orderNumber: string; status: string }
  | { ok: false; status: 400 | 404 | 409 | 500; message: string }
> {
  const [order] = await database
    .select()
    .from(studentBookOrders)
    .where(eq(studentBookOrders.id, input.orderId));

  if (!order) {
    return { ok: false, status: 404, message: "Pesanan tidak ditemukan" };
  }
  if (order.studentId !== input.studentId) {
    return { ok: false, status: 400, message: "Pesanan tidak sesuai dengan data siswa" };
  }
  if (order.fulfillmentStatus === "return_in_progress") {
    return { ok: false, status: 400, message: "Pengajuan pembatalan / refund untuk pesanan ini sedang diproses" };
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
    const letterKey = `withdrawals/books/${order.id}-${Date.now()}.${ext}`;
    letterProofUrl = await store.upload(letterKey, buffer, mime);
  }

  // Cari buku pertama dalam pesanan untuk dicatat di book_returns
  let defectiveBookId: string | null = null;
  if (order.packageId) {
    const [bom] = await database
      .select({ bookId: bookPackageItems.bookId })
      .from(bookPackageItems)
      .where(eq(bookPackageItems.packageId, order.packageId))
      .limit(1);
    if (bom) defectiveBookId = bom.bookId;
  }
  if (!defectiveBookId) {
    const [loose] = await database
      .select({ bookId: studentOrderItems.bookId })
      .from(studentOrderItems)
      .where(eq(studentOrderItems.orderId, order.id))
      .limit(1);
    if (loose) defectiveBookId = loose.bookId;
  }
  if (!defectiveBookId) {
    defectiveBookId = "book-wpr-weekly-report";
  }

  const returnId = `ret-wdr-${deps.generateId?.() ?? Date.now()}`;
  const reasonText = `[PENGUNDURAN DIRI] ${input.reason.trim()}`;

  try {
    await runWriteBatch(database, [
      database.insert(bookReturns).values({
        id: returnId,
        orderId: order.id,
        studentId: order.studentId,
        defectiveBookId,
        reason: reasonText,
        photoProofUrl: letterProofUrl,
        status: "reported",
        createdAt: now,
        updatedAt: now,
      }),
      database
        .update(studentBookOrders)
        .set({ fulfillmentStatus: "return_in_progress", updatedAt: now })
        .where(eq(studentBookOrders.id, order.id)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "pengajuan pembatalan buku");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: "return_in_progress",
  };
}

export async function approveBookWithdrawal(
  database: AppDatabase,
  returnId: string,
  actorUserId?: string,
  deps: BookWithdrawalDeps = {}
): Promise<
  | { ok: true; slip: NonNullable<Awaited<ReturnType<typeof findRefundSlip>>>; message: string }
  | { ok: false; status: 400 | 404 | 409 | 500; message: string }
> {
  const now = writeNow(deps);
  const [ret] = await database.select().from(bookReturns).where(eq(bookReturns.id, returnId));
  if (!ret) {
    return { ok: false, status: 404, message: "Laporan pembatalan retur tidak ditemukan" };
  }

  const [order] = await database
    .select()
    .from(studentBookOrders)
    .where(eq(studentBookOrders.id, ret.orderId));
  if (!order) {
    return { ok: false, status: 404, message: "Pesanan tidak ditemukan" };
  }

  const [student] = await database.select().from(students).where(eq(students.id, order.studentId));

  const generateSlip =
    deps.generateSlipNumber ??
    (() => documentNumber("RET-B", epochTimeFragment(Date.now(), 6), randomSerial(6)));
  const slipNumber = generateSlip(now);
  const refundAmount = order.paidAmount > 0 ? order.paidAmount : order.totalAmount;

  const writeOps = [];

  // 1. Unassign alokasi paket cabang otomatis menjadi stok bebas
  if (order.assignedPackageItemId) {
    writeOps.push(
      database
        .update(packageItems)
        .set({ status: "in_stock", updatedAt: now })
        .where(eq(packageItems.id, order.assignedPackageItemId))
    );
  }

  // 2. Update status book_returns menjadi approved
  writeOps.push(
    database
      .update(bookReturns)
      .set({
        status: "approved",
        refundAmount,
        handledByUserId: actorUserId ?? null,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(bookReturns.id, returnId))
  );

  // 3. Batalkan atau update pesanan murid: jika ada paket unassigned, set assignedPackageItemId = null
  writeOps.push(
    database
      .update(studentBookOrders)
      .set({
        assignedPackageItemId: null,
        updatedAt: now,
      })
      .where(eq(studentBookOrders.id, order.id))
  );

  // 4. Terbitkan Slip Bukti Pengembalian resmi untuk Finance (tabel, bukan KV).
  writeOps.push(
    refundSlipInsertQuery(database, {
      kind: "buku",
      slipNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      studentId: order.studentId,
      studentName: student?.name ?? "Siswa",
      nis: student?.nis ?? "-",
      schoolId: order.schoolId,
      refundAmount,
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
  if (!slip) {
    return { ok: false, status: 500, message: "Slip pengembalian gagal dibaca setelah disimpan." };
  }
  return {
    ok: true,
    slip,
    message: `Pembatalan buku disetujui. Alokasi stok paket telah di-unassign menjadi stok bebas dan Slip ${slipNumber} diterbitkan untuk Finance.`,
  };
}
