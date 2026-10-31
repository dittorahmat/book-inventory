import { and, eq, inArray } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../../db";
import { bookPackageItems, bookReturns, studentBookOrders, studentOrderItems } from "../../../db/schema";
import { defaultStorage, type StorageService } from "../../../services/storage";
import { decodeBase64ToBytes } from "../../base64";
import { detectImageMime } from "../../../lib/book-return";
import { WPR_BOOK_ID } from "../../../lib/wpr";
import { d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";
import { isOrderReportable, RETURN_OPEN_STATUSES } from "./flow";

/**
 * Resolusi ID buku untuk retur pembatalan pengunduran diri (withdrawal):
 * Pada skema relasional, `book_returns.defective_book_id` memiliki foreign key NOT NULL
 * ke tabel `books`. Jika pesanan paket, pilih item pertama dari BOM paket pesanan.
 * Jika pesanan satuan, pilih item buku pertama yang dipesan.
 * Jika pesanan belum memiliki alokasi fisik / baris satuan, fallback kanonik adalah
 * baris buku komponen wajib WPR (`WPR_BOOK_ID`) agar integritas FK tetap terpenuhi
 * tanpa membiarkan nilai acak atau string bebas.
 */
const pickWithdrawalBookId = async (
  database: AppDatabase,
  order: typeof studentBookOrders.$inferSelect
): Promise<string> => {
  if (order.packageId) {
    const [bom] = await database
      .select({ bookId: bookPackageItems.bookId })
      .from(bookPackageItems)
      .where(eq(bookPackageItems.packageId, order.packageId))
      .limit(1);
    if (bom) return bom.bookId;
  }
  const [loose] = await database
    .select({ bookId: studentOrderItems.bookId })
    .from(studentOrderItems)
    .where(eq(studentOrderItems.orderId, order.id))
    .limit(1);
  return loose?.bookId ?? WPR_BOOK_ID;
};

export type ReturnSource = "staff" | "public";
/** defect = barang cacat; withdrawal = murid mengundurkan diri (ADR-0019). */
export type ReturnKind = "defect" | "withdrawal";

export interface ReportReturnInput {
  orderId: string;
  studentId: string;
  /** Wajib untuk defect; untuk withdrawal boleh kosong (dipilih otomatis). */
  defectiveBookId?: string;
  kind?: ReturnKind;
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
 * Kedua sumber menolak laporan terbuka ganda untuk buku yang sama (anti double
 * refund) lewat validasi pra-tulis yang mengembalikan 400 (§10.3).
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
  const kind: ReturnKind = input.kind ?? "defect";
  // Jalur withdrawal terjadi SEBELUM serah terima (murid mundur), jadi gerbang
  // "harus picked_up" tidak berlaku; yang dilarang hanya pengajuan ganda.
  if (kind === "withdrawal") {
    if (order.fulfillmentStatus === "return_in_progress") {
      return {
        ok: false,
        status: 400,
        message: "Pengajuan pembatalan / refund untuk pesanan ini sedang diproses",
      };
    }
  } else {
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
  }

  const defectiveBookId =
    input.defectiveBookId?.trim() ||
    (kind === "withdrawal" ? await pickWithdrawalBookId(database, order) : "");
  if (!defectiveBookId) {
    return { ok: false, status: 400, message: "Buku yang diretur wajib dipilih." };
  }

  // Satu buku tidak boleh punya dua laporan cacat terbuka sekaligus. Withdrawal
  // tidak mengunci buku: seluruh pesanan dibatalkan, bukan satu judul.
  if (kind === "defect") {
    const [openDuplicate] = await database
      .select({ id: bookReturns.id, status: bookReturns.status })
      .from(bookReturns)
      .where(
        and(
          eq(bookReturns.orderId, input.orderId),
          eq(bookReturns.defectiveBookId, defectiveBookId),
          eq(bookReturns.kind, "defect"),
          inArray(bookReturns.status, [...RETURN_OPEN_STATUSES])
        )
      )
      .limit(1);
    if (openDuplicate) {
      return {
        ok: false,
        status: 400,
        message: `Buku ini sudah dilaporkan dan sedang diproses (status ${openDuplicate.status}). Selesaikan laporan itu sebelum mengajukan retur baru untuk buku yang sama.`,
      };
    }
  }
  // Buku yang direfund harus benar-benar bagian dari paket pesanan, bukan judul
  // lain yang kebetulan ada di katalog. Pesanan satuan tidak punya BOM sehingga
  // pemeriksaan ini dilewati (daftar bukunya tidak diekspos di portal).
  if (kind === "defect" && input.source === "public" && order.packageId) {
    const [bom] = await database
      .select({ id: bookPackageItems.id })
      .from(bookPackageItems)
      .where(
        and(
          eq(bookPackageItems.packageId, order.packageId),
          eq(bookPackageItems.bookId, defectiveBookId)
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
    const prefix = kind === "withdrawal" ? "withdrawals/books/" : input.source === "public" ? "returns/public_" : "returns/";
    photoKey = `${prefix}${returnId}_${Date.now()}.${extension}`;
    photoProofUrl = await store.upload(photoKey, buffer, contentType);
  }

  try {
    await runWriteBatch(database, [
      database.insert(bookReturns).values({
        id: returnId,
        orderId: input.orderId,
        studentId: input.studentId,
        defectiveBookId,
        kind,
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
