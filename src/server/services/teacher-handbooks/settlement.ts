import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { books, teacherHandbookAllocations, teacherHandbookOrders } from "../../../db/schema";
import { TeacherHandbookError, getTeacherHandbookOrderById } from "./index";

export async function computeAndSaveSettlementAmount(
  db: AppDatabase,
  orderId: string,
  now: Date = new Date()
) {
  const rows = await db
    .select({
      deliveredQuantity: teacherHandbookAllocations.deliveredQuantity,
      price: books.price,
    })
    .from(teacherHandbookAllocations)
    .leftJoin(books, eq(teacherHandbookAllocations.bookId, books.id))
    .where(eq(teacherHandbookAllocations.orderId, orderId));

  const totalAmount = rows.reduce(
    (sum, r) => sum + (r.deliveredQuantity ?? 0) * (r.price ?? 0),
    0
  );

  await db
    .update(teacherHandbookOrders)
    .set({
      settlementAmount: totalAmount,
      updatedAt: now.toISOString(),
    })
    .where(eq(teacherHandbookOrders.id, orderId));

  return totalAmount;
}

export async function submitTeacherHandbookPaymentProof(
  db: AppDatabase,
  orderId: string,
  paymentProofUrl: string,
  schoolScope?: string | null,
  now: Date = new Date()
) {
  const [order] = await db
    .select()
    .from(teacherHandbookOrders)
    .where(eq(teacherHandbookOrders.id, orderId));
  if (!order) {
    throw new TeacherHandbookError("Pesanan Pegangan Guru tidak ditemukan.", 404);
  }
  if (schoolScope && order.schoolId !== schoolScope) {
    throw new TeacherHandbookError("Tidak memiliki akses ke pesanan cabang lain.", 403);
  }
  if (order.status !== "received" && order.status !== "completed") {
    throw new TeacherHandbookError(
      "Bukti transfer hanya dapat diunggah setelah kiriman diterima cabang.",
      400
    );
  }

  await db
    .update(teacherHandbookOrders)
    .set({
      paymentProofUrl: paymentProofUrl.trim(),
      updatedAt: now.toISOString(),
    })
    .where(eq(teacherHandbookOrders.id, orderId));

  return getTeacherHandbookOrderById(db, orderId);
}

export async function verifyTeacherHandbookSettlement(
  db: AppDatabase,
  orderId: string,
  paidAmount: number,
  now: Date = new Date()
) {
  const [order] = await db
    .select()
    .from(teacherHandbookOrders)
    .where(eq(teacherHandbookOrders.id, orderId));
  if (!order) {
    throw new TeacherHandbookError("Pesanan Pegangan Guru tidak ditemukan.", 404);
  }
  if (order.status !== "received" && order.status !== "completed") {
    throw new TeacherHandbookError("Pesanan belum diterima cabang.", 400);
  }
  if (!order.paymentProofUrl) {
    throw new TeacherHandbookError("Bukti transfer belum diunggah oleh cabang.", 400);
  }
  if (paidAmount < 0) {
    throw new TeacherHandbookError("Nominal pembayaran tidak boleh negatif.", 400);
  }

  const nextPaid = order.paidAmount + paidAmount;
  const nextStatus: "unpaid" | "partial" | "paid" =
    nextPaid >= order.settlementAmount && order.settlementAmount > 0
      ? "paid"
      : nextPaid > 0
        ? "partial"
        : "unpaid";

  const isoNow = now.toISOString();
  await db
    .update(teacherHandbookOrders)
    .set({
      paidAmount: nextPaid,
      settlementStatus: nextStatus,
      settledAt: nextStatus === "paid" ? isoNow : null,
      updatedAt: isoNow,
    })
    .where(eq(teacherHandbookOrders.id, orderId));

  return getTeacherHandbookOrderById(db, orderId);
}
