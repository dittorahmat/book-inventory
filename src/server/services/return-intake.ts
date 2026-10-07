import { eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { bookReturns, studentBookOrders } from "../../db/schema";
import { defaultStorage } from "../../services/storage";
import { decodeBase64ToBytes } from "../base64";

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

/**
 * Satu-satunya pemilik intake retur: simpan foto → insert `reported` →
 * tandai order `return_in_progress`. Dipakai jalur staf dan publik.
 */
export async function reportReturn(
  database: AppDatabase,
  input: ReportReturnInput
): Promise<ReportReturnResult> {
  const [order] = await database
    .select()
    .from(studentBookOrders)
    .where(eq(studentBookOrders.id, input.orderId));
  if (!order) {
    return { ok: false, status: 404, message: "Data pesanan tidak ditemukan" };
  }

  const now = new Date().toISOString();
  const returnId = crypto.randomUUID();

  let photoProofUrl: string | null = null;
  if (input.photoProofBase64) {
    const prefix = input.source === "public" ? "returns/public_" : "returns/";
    const buffer = decodeBase64ToBytes(input.photoProofBase64);
    photoProofUrl = await defaultStorage.upload(`${prefix}${returnId}_${Date.now()}.jpg`, buffer, "image/jpeg");
  }

  await database.insert(bookReturns).values({
    id: returnId,
    orderId: input.orderId,
    studentId: input.studentId,
    defectiveBookId: input.defectiveBookId,
    reason: input.reason,
    photoProofUrl,
    status: "reported",
    createdAt: now,
    updatedAt: now,
  });

  await database
    .update(studentBookOrders)
    .set({ fulfillmentStatus: "return_in_progress", updatedAt: now })
    .where(eq(studentBookOrders.id, input.orderId));

  const [created] = await database.select().from(bookReturns).where(eq(bookReturns.id, returnId));
  return { ok: true, created, orderNumber: order.orderNumber };
}
