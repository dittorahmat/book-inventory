import { eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { bookReturns, studentBookOrders } from "../../db/schema";
import { defaultStorage, type StorageService } from "../../services/storage";
import { decodeBase64ToBytes } from "../base64";
import { d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";
import { isOrderReportable } from "./return-flow";

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
    return { ok: false, status: 404, message: "Data pesanan tidak ditemukan" };
  }
  if (!isOrderReportable(order.fulfillmentStatus)) {
    return {
      ok: false,
      status: 400,
      message: `Pesanan berstatus ${order.fulfillmentStatus}, retur hanya dapat dilaporkan setelah serah terima (picked_up).`,
    };
  }

  const store: StorageService = deps.storage ?? defaultStorage;
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const returnId = (deps.generateId ?? (() => crypto.randomUUID()))();

  let photoProofUrl: string | null = null;
  let photoKey: string | null = null;
  if (input.photoProofBase64) {
    const prefix = input.source === "public" ? "returns/public_" : "returns/";
    const buffer = decodeBase64ToBytes(input.photoProofBase64);
    photoKey = `${prefix}${returnId}_${Date.now()}.jpg`;
    photoProofUrl = await store.upload(photoKey, buffer, "image/jpeg");
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
