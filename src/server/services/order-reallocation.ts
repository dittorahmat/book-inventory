import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { AppDatabase } from "../../db";
import {
  paymentAllocations,
  studentBookOrders,
  students,
  uniformOrders,
} from "../../db/schema";
import { d1WriteErrorStatus, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";
import { documentNumber, epochTimeFragment, randomSerial } from "../lib/document-number";
import { refundSlipInsertQuery } from "./refund-slip";

export type PaymentKind = "buku" | "seragam";

export interface PaymentReallocationResult {
  ok: boolean;
  status?: 400 | 404 | 409;
  message?: string;
  reallocatedAmount?: number;
  newOrderPaidAmount?: number;
  refundPendingAmount?: number;
  refundSlipNumber?: string;
}

/**
 * Membangun query mutasi realokasi pembayaran & beasiswa dari pesanan lama ke pesanan pengganti (ADR-0021).
 */
export async function buildReallocatePaymentQueries(
  database: AppDatabase,
  input: {
    kind: PaymentKind;
    oldOrderId: string;
    newOrderId: string;
  },
  deps: WriteDeps = {}
): Promise<
  | {
      ok: true;
      queries: BatchItem<"sqlite">[];
      reallocatedAmount: number;
      newOrderPaidAmount: number;
      refundPendingAmount: number;
      refundSlipNumber?: string;
    }
  | { ok: false; status: 400 | 404; message: string }
> {
  const now = writeNow(deps);
  const queries: BatchItem<"sqlite">[] = [];

  if (input.kind === "buku") {
    const [oldOrder] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, input.oldOrderId));
    if (!oldOrder) return { ok: false, status: 404, message: "Pesanan buku lama tidak ditemukan" };

    const [newOrder] = await database.select().from(studentBookOrders).where(eq(studentBookOrders.id, input.newOrderId));
    if (!newOrder) return { ok: false, status: 404, message: "Pesanan buku baru tidak ditemukan" };

    // 1. Tangani Beasiswa: jika pesanan lama beasiswa, salin bukti dan approve statusnya
    if (oldOrder.orderType === "scholarship" || oldOrder.paymentStatus === "scholarship_approved") {
      queries.push(
        database
          .update(studentBookOrders)
          .set({
            orderType: "scholarship",
            paymentStatus: "scholarship_approved",
            scholarshipProofUrl: oldOrder.scholarshipProofUrl ?? newOrder.scholarshipProofUrl,
            financeHandoverApproved: true,
            updatedAt: now,
          })
          .where(eq(studentBookOrders.id, newOrder.id))
      );
      return { ok: true, queries, reallocatedAmount: 0, newOrderPaidAmount: 0, refundPendingAmount: 0 };
    }

    // 2. Ambil seluruh alokasi pembayaran pesanan lama
    const allocations = await database
      .select()
      .from(paymentAllocations)
      .where(and(eq(paymentAllocations.kind, "buku"), eq(paymentAllocations.orderId, oldOrder.id)));

    const totalOldAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    if (totalOldAllocated <= 0) {
      return { ok: true, queries, reallocatedAmount: 0, newOrderPaidAmount: newOrder.paidAmount, refundPendingAmount: 0 };
    }

    // Alihkan alokasi ke orderId baru
    for (const alloc of allocations) {
      queries.push(
        database
          .update(paymentAllocations)
          .set({ orderId: newOrder.id })
          .where(eq(paymentAllocations.id, alloc.id))
      );
    }

    const bill = newOrder.totalAmount + (newOrder.shippingCost ?? 0);
    let newPaid = totalOldAllocated;
    let refundAmount = 0;
    let slipNumber: string | undefined;

    if (totalOldAllocated > bill && bill > 0) {
      newPaid = bill;
      refundAmount = totalOldAllocated - bill;

      // Terbitkan slip refund pending untuk Finance (ADR-0021)
      const [student] = await database.select().from(students).where(eq(students.id, newOrder.studentId));
      slipNumber = documentNumber("RET-B", epochTimeFragment(Date.now(), 6), randomSerial(6));
      queries.push(
        refundSlipInsertQuery(database, {
          kind: "buku",
          slipNumber,
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          studentId: newOrder.studentId,
          studentName: student?.name ?? "Siswa",
          nis: student?.nis ?? "-",
          schoolId: newOrder.schoolId,
          refundAmount,
          approvedAt: now,
        })
      );
    }

    const newPaymentStatus = newPaid >= bill && bill > 0 ? "paid" : newPaid > 0 ? "partial" : "unpaid";
    queries.push(
      database
        .update(studentBookOrders)
        .set({
          paidAmount: newPaid,
          paymentStatus: newPaymentStatus,
          firstPaymentProofUrl: oldOrder.firstPaymentProofUrl ?? newOrder.firstPaymentProofUrl,
          parentPhoneManual: oldOrder.parentPhoneManual ?? newOrder.parentPhoneManual,
          updatedAt: now,
        })
        .where(eq(studentBookOrders.id, newOrder.id))
    );

    // Update pesanan lama agar paidAmount = 0
    queries.push(
      database
        .update(studentBookOrders)
        .set({ paidAmount: 0, updatedAt: now })
        .where(eq(studentBookOrders.id, oldOrder.id))
    );

    return {
      ok: true,
      queries,
      reallocatedAmount: totalOldAllocated,
      newOrderPaidAmount: newPaid,
      refundPendingAmount: refundAmount,
      refundSlipNumber: slipNumber,
    };
  }

  // Seragam
  const [oldOrder] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, input.oldOrderId));
  if (!oldOrder) return { ok: false, status: 404, message: "Pesanan seragam lama tidak ditemukan" };

  const [newOrder] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, input.newOrderId));
  if (!newOrder) return { ok: false, status: 404, message: "Pesanan seragam baru tidak ditemukan" };

  if (oldOrder.orderType === "scholarship" || oldOrder.paymentStatus === "scholarship_pending") {
    queries.push(
      database
        .update(uniformOrders)
        .set({
          orderType: "scholarship",
          paymentStatus: "scholarship_pending",
          scholarshipProofUrl: oldOrder.scholarshipProofUrl ?? newOrder.scholarshipProofUrl,
          updatedAt: now,
        })
        .where(eq(uniformOrders.id, newOrder.id))
    );
    return { ok: true, queries, reallocatedAmount: 0, newOrderPaidAmount: 0, refundPendingAmount: 0 };
  }

  const allocations = await database
    .select()
    .from(paymentAllocations)
    .where(and(eq(paymentAllocations.kind, "seragam"), eq(paymentAllocations.orderId, oldOrder.id)));

  const totalOldAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  if (totalOldAllocated <= 0) {
    return { ok: true, queries, reallocatedAmount: 0, newOrderPaidAmount: newOrder.paidAmount, refundPendingAmount: 0 };
  }

  for (const alloc of allocations) {
    queries.push(
      database
        .update(paymentAllocations)
        .set({ orderId: newOrder.id })
        .where(eq(paymentAllocations.id, alloc.id))
    );
  }

  const bill = newOrder.totalAmount + (newOrder.shippingCost ?? 0);
  let newPaid = totalOldAllocated;
  let refundAmount = 0;
  let slipNumber: string | undefined;

  if (totalOldAllocated > bill && bill > 0) {
    newPaid = bill;
    refundAmount = totalOldAllocated - bill;

    const [student] = await database.select().from(students).where(eq(students.id, newOrder.studentId));
    slipNumber = documentNumber("RET-U", epochTimeFragment(Date.now(), 6), randomSerial(6));
    queries.push(
      refundSlipInsertQuery(database, {
        kind: "seragam",
        slipNumber,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        studentId: newOrder.studentId,
        studentName: student?.name ?? "Siswa",
        nis: student?.nis ?? "-",
        schoolId: newOrder.schoolId,
        refundAmount,
        approvedAt: now,
      })
    );
  }

  const newPaymentStatus = newPaid >= bill && bill > 0 ? "paid" : newPaid > 0 ? "partial" : "unpaid";
  queries.push(
    database
      .update(uniformOrders)
      .set({
        paidAmount: newPaid,
        paymentStatus: newPaymentStatus,
        updatedAt: now,
      })
      .where(eq(uniformOrders.id, newOrder.id))
  );

  queries.push(
    database
      .update(uniformOrders)
      .set({ paidAmount: 0, updatedAt: now })
      .where(eq(uniformOrders.id, oldOrder.id))
  );

  return {
    ok: true,
    queries,
    reallocatedAmount: totalOldAllocated,
    newOrderPaidAmount: newPaid,
    refundPendingAmount: refundAmount,
    refundSlipNumber: slipNumber,
  };
}

/**
 * Eksekusi realokasi pembayaran & beasiswa secara atomik.
 */
export async function reallocatePaymentToOrder(
  database: AppDatabase,
  input: {
    kind: PaymentKind;
    oldOrderId: string;
    newOrderId: string;
  },
  deps: WriteDeps = {}
): Promise<PaymentReallocationResult> {
  const prepared = await buildReallocatePaymentQueries(database, input, deps);
  if (!prepared.ok) return prepared;

  try {
    if (prepared.queries.length > 0) {
      await runWriteBatch(database, prepared.queries);
    }
    return {
      ok: true,
      reallocatedAmount: prepared.reallocatedAmount,
      newOrderPaidAmount: prepared.newOrderPaidAmount,
      refundPendingAmount: prepared.refundPendingAmount,
      refundSlipNumber: prepared.refundSlipNumber,
    };
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "realokasi pembayaran pesanan");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
}
