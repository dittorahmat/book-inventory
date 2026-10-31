import { eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { bookReturns, packageItems, studentBookOrders, students } from "../../db/schema";
import { d1WriteErrorStatus, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";
import { documentNumber, epochTimeFragment, randomSerial } from "../lib/document-number";
import type { StorageService } from "../../services/storage";
import { findRefundSlip, refundSlipInsertQuery } from "./refund-slip";
import { reportReturn } from "./return";

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

/**
 * Pengajuan pembatalan buku = intake retur ber-`kind: "withdrawal"`.
 * Satu penulis baris `book_returns` (return/intake), satu gerbang status;
 * modul ini hanya menambah arti "murid mundur" + slip Finance.
 */
export async function requestBookWithdrawal(
  database: AppDatabase,
  input: RequestBookWithdrawalInput,
  deps: BookWithdrawalDeps = {}
): Promise<
  | { ok: true; orderId: string; orderNumber: string; status: string }
  | { ok: false; status: ContentfulStatusCode; message: string }
> {
  const result = await reportReturn(
    database,
    {
      orderId: input.orderId,
      studentId: input.studentId,
      kind: "withdrawal",
      reason: input.reason.trim(),
      photoProofBase64: input.letterProofBase64,
      source: "public",
    },
    { storage: deps.storage, generateId: deps.generateId, now: deps.now ? () => deps.now as string : undefined }
  );
  if (!result.ok) return result;
  return {
    ok: true,
    orderId: result.created.orderId,
    orderNumber: result.orderNumber,
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
  if (ret.kind !== "withdrawal") {
    return {
      ok: false,
      status: 400,
      message: "Laporan ini bukan pengajuan pengunduran diri; selesaikan lewat jalur retur barang cacat.",
    };
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
      sourceId: returnId,
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
