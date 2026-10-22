import { and, eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../../db";
import { bookPackageItems, bookReturns, studentBookOrders } from "../../../db/schema";
import { defaultStorage, type StorageService } from "../../../services/storage";
import { decodeBase64ToBytes } from "../../base64";
import { detectImageMime } from "../../../lib/book-return";
import { d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";
import { isOrderReportable } from "./flow";

export type ReturnSource = "staff" | "public";

export interface ReportReturnInput {
  orderId: string;
  studentId: string;
  defectiveBookId: string;
  reason: string;
  photoProofBase64?: string | null;
  source: ReturnSource;
}

export type ReportReturnResult =
  | { ok: true; created: typeof bookReturns.$inferSelect; orderNumber: string }
  | { ok: false; status: ContentfulStatusCode; message: string };

export interface ReportReturnDeps {
  storage?: StorageService;
  generateId?: () => string;
  now?: () => string;
}

/**
 * Satu-satunya pemilik intake retur: simpan foto → insert `reported` →
 * tandai order `return_in_progress`. Berbagi mesin status reportable dengan
 * resolveReturn (order-fulfilment): hanya order picked_up/return_in_progress
 * yang boleh dilaporkan; seluruh tulis DB satu batch atomik (§10 D1).
 * Sumber publik diperketat: satu pengajuan per pesanan (hanya `picked_up`),
 * buku wajib bagian dari BOM paket, dan foto diverifikasi dari magic bytes.
 * Storage diterima di seam (default produksi) agar test memakai in-memory;
 * upload gagal-tulis dikompensasi (best-effort delete) supaya tak orphan.
 */
export async function reportReturn(
  database: AppDatabase,
  input: ReportReturnInput,
  deps: ReportReturnDeps = {}
): Promise<ReportReturnResult> {
  const [order] = await database
    .select()
    .from(studentBookOrders)
    .where(eq(studentBookOrders.id, input.orderId));
  if (!order) {
    return { ok: false, status: 404, message: "Pesanan tidak ditemukan" };
  }
  if (order.studentId !== input.studentId) {
    return {
      ok: false,
      status: 400,
      message: "Pesanan tidak sesuai dengan data siswa yang dipilih",
    };
  }
  // Sumber publik hanya boleh mengajukan sekali per pesanan; staf tetap boleh
  // menambah item retur lain dari pesanan yang sama (`return_in_progress`).
  if (input.source === "public" && order.fulfillmentStatus !== "picked_up") {
    return {
      ok: false,
      status: 400,
      message:
        order.fulfillmentStatus === "return_in_progress"
          ? "Pengajuan refund untuk pesanan ini sudah dikirim dan sedang diproses logistik."
          : `Pesanan berstatus ${order.fulfillmentStatus}, retur hanya dapat dilaporkan setelah serah terima (picked_up).`,
    };
  }
  if (!isOrderReportable(order.fulfillmentStatus)) {
    return {
      ok: false,
      status: 400,
      message: `Pesanan berstatus ${order.fulfillmentStatus}, retur hanya dapat dilaporkan setelah serah terima (picked_up).`,
    };
  }
  // Buku yang direfund harus benar-benar bagian dari paket pesanan, bukan judul
  // lain yang kebetulan ada di katalog. Pesanan satuan tidak punya BOM sehingga
  // pemeriksaan ini dilewati (daftar bukunya tidak diekspos di portal).
  if (input.source === "public" && order.packageId) {
    const [bom] = await database
      .select({ id: bookPackageItems.id })
      .from(bookPackageItems)
      .where(
        and(
          eq(bookPackageItems.packageId, order.packageId),
          eq(bookPackageItems.bookId, input.defectiveBookId)
        )
      )
      .limit(1);
    if (!bom) {
      return { ok: false, status: 400, message: "Buku yang dipilih bukan bagian dari paket pesanan ini" };
    }
  }

  const store: StorageService = deps.storage ?? defaultStorage;
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const returnId = (deps.generateId ?? (() => crypto.randomUUID()))();

  let photoProofUrl: string | null = null;
  let photoKey: string | null = null;
  if (input.photoProofBase64) {
    let buffer: Uint8Array;
    try {
      buffer = decodeBase64ToBytes(input.photoProofBase64);
    } catch {
      return { ok: false, status: 400, message: "Foto bukti tidak dapat dibaca, silakan unggah ulang" };
    }
    // Bukti publik tidak dipercaya dari content-type klien: tipe asli dibaca
    // dari magic bytes, dan non-gambar ditolak sebelum menyentuh storage.
    const detected = detectImageMime(buffer);
    if (input.source === "public" && !detected) {
      return { ok: false, status: 400, message: "Foto bukti harus berupa gambar JPG/PNG/WebP" };
    }
    const contentType = detected ?? "image/jpeg";
    const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const prefix = input.source === "public" ? "returns/public_" : "returns/";
    photoKey = `${prefix}${returnId}_${Date.now()}.${extension}`;
    photoProofUrl = await store.upload(photoKey, buffer, contentType);
  }

  try {
    await runWriteBatch(database, [
      database.insert(bookReturns).values({
        id: returnId,
        orderId: input.orderId,
        studentId: input.studentId,
        defectiveBookId: input.defectiveBookId,
        reason: input.reason,
        photoProofUrl,
        status: "reported",
        createdAt: now,
        updatedAt: now,
      }),
      database
        .update(studentBookOrders)
        .set({ fulfillmentStatus: "return_in_progress", updatedAt: now })
        .where(eq(studentBookOrders.id, input.orderId)),
    ]);
  } catch (err) {
    if (photoKey) {
      try {
        await store.delete(photoKey);
      } catch {
        // Kompensasi best-effort: kegagalan hapus tidak menutupi error asli.
      }
    }
    const mapped = d1WriteErrorStatus(err, "pelaporan retur");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  const [created] = await database.select().from(bookReturns).where(eq(bookReturns.id, returnId));
  return { ok: true, created, orderNumber: order.orderNumber };
}
