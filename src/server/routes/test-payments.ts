import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { paymentAllocations, paymentReceipts } from "../../db/schema";

/** Struk + porsi alokasinya untuk satu order (satu baris per alokasi). */
export const selectReceiptsForOrder = (orderId: string) =>
  db
    .select({ receipt: paymentReceipts, allocation: paymentAllocations })
    .from(paymentAllocations)
    .innerJoin(paymentReceipts, eq(paymentReceipts.id, paymentAllocations.receiptId))
    .where(eq(paymentAllocations.orderId, orderId));

/** Hapus alokasi lalu struk milik sekumpulan order (anak dulu, induk kemudian). */
export const deleteReceiptsForOrders = async (orderIds: string[]): Promise<void> => {
  if (orderIds.length === 0) return;
  const rows = await db
    .select({ receiptId: paymentAllocations.receiptId })
    .from(paymentAllocations)
    .where(inArray(paymentAllocations.orderId, orderIds));
  const receiptIds = [...new Set(rows.map((row) => row.receiptId))];
  await db.delete(paymentAllocations).where(inArray(paymentAllocations.orderId, orderIds));
  if (receiptIds.length > 0) {
    await db.delete(paymentReceipts).where(inArray(paymentReceipts.id, receiptIds));
  }
};
