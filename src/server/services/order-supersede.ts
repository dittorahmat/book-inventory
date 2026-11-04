import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { AppDatabase } from "../../db";
import {
  packageItems,
  studentBookOrders,
  uniformOrderItems,
  uniformOrders,
} from "../../db/schema";
import { d1WriteErrorStatus, runWriteBatch, writeNow, type WriteDeps } from "../lib/d1-write";
import { adjustPackageStockQuery, adjustVariantStockQuery } from "./uniform/stock";

export interface SupersedeBookOrderInput {
  orderId: string;
  supersededByOrderId?: string;
}

export interface SupersedeUniformOrderInput {
  orderId: string;
  supersededByOrderId?: string;
}

export interface SupersedeOrderResult {
  ok: boolean;
  status?: 400 | 404 | 409;
  message?: string;
  orderId?: string;
  supersededByOrderId?: string;
}

/**
 * Membangun query mutasi untuk menandai pesanan buku sebagai `superseded`
 * dan melepaskan alokasi paket cabang (`assignedPackageItemId`) kembali menjadi `in_stock`.
 */
export async function buildSupersedeBookOrderQueries(
  database: AppDatabase,
  input: SupersedeBookOrderInput,
  deps: WriteDeps = {}
): Promise<{ ok: true; queries: BatchItem<"sqlite">[]; order: typeof studentBookOrders.$inferSelect } | { ok: false; status: 400 | 404; message: string }> {
  const [order] = await database
    .select()
    .from(studentBookOrders)
    .where(eq(studentBookOrders.id, input.orderId));

  if (!order) {
    return { ok: false, status: 404, message: "Pesanan buku tidak ditemukan" };
  }

  if (order.fulfillmentStatus === "picked_up") {
    return { ok: false, status: 400, message: "Pesanan buku yang sudah diserahterimakan tidak dapat ditimpa" };
  }

  if (order.fulfillmentStatus === "superseded") {
    return { ok: false, status: 400, message: "Pesanan buku sudah berstatus superseded" };
  }

  const now = writeNow(deps);
  const queries: BatchItem<"sqlite">[] = [];

  // 1. Unassign alokasi paket cabang jika ada
  if (order.assignedPackageItemId) {
    queries.push(
      database
        .update(packageItems)
        .set({ status: "in_stock", updatedAt: now })
        .where(eq(packageItems.id, order.assignedPackageItemId))
    );
  }

  // 2. Tandai pesanan buku sebagai superseded
  queries.push(
    database
      .update(studentBookOrders)
      .set({
        fulfillmentStatus: "superseded",
        assignedPackageItemId: null,
        supersededByOrderId: input.supersededByOrderId ?? null,
        updatedAt: now,
      })
      .where(eq(studentBookOrders.id, order.id))
  );

  return { ok: true, queries, order };
}

/**
 * Eksekusi supersede pesanan buku secara atomik.
 */
export async function supersedeBookOrder(
  database: AppDatabase,
  input: SupersedeBookOrderInput,
  deps: WriteDeps = {}
): Promise<SupersedeOrderResult> {
  const prepared = await buildSupersedeBookOrderQueries(database, input, deps);
  if (!prepared.ok) return prepared;

  try {
    await runWriteBatch(database, prepared.queries);
    return {
      ok: true,
      orderId: prepared.order.id,
      supersededByOrderId: input.supersededByOrderId,
    };
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "supersede pesanan buku");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
}

/**
 * Membangun query mutasi untuk menandai pesanan seragam sebagai `superseded`
 * dan melepaskan alokasi stok fisik (varian/paket) kembali ke stok gudang pusat via seam kanonik `uniform/stock`.
 */
export async function buildSupersedeUniformOrderQueries(
  database: AppDatabase,
  input: SupersedeUniformOrderInput,
  deps: WriteDeps = {}
): Promise<{ ok: true; queries: BatchItem<"sqlite">[]; order: typeof uniformOrders.$inferSelect } | { ok: false; status: 400 | 404; message: string }> {
  const [order] = await database
    .select()
    .from(uniformOrders)
    .where(eq(uniformOrders.id, input.orderId));

  if (!order) {
    return { ok: false, status: 404, message: "Pesanan seragam tidak ditemukan" };
  }

  if (order.shipmentStatus === "sudah_dikirim" || Boolean(order.shippingResi)) {
    return { ok: false, status: 400, message: "Pesanan seragam yang sudah dikirim atau memiliki nomor resi tidak dapat ditimpa" };
  }

  if (order.shipmentStatus === "superseded") {
    return { ok: false, status: 400, message: "Pesanan seragam sudah berstatus superseded" };
  }

  const now = writeNow(deps);
  const items = await database
    .select()
    .from(uniformOrderItems)
    .where(eq(uniformOrderItems.orderId, order.id));

  const queries: BatchItem<"sqlite">[] = [];

  // 1. Restock fisik seragam via seam uniform/stock
  for (const item of items) {
    if (item.variantId) {
      queries.push(
        adjustVariantStockQuery(
          database,
          { variantId: item.variantId, size: item.size, delta: item.quantity },
          "create",
          { now }
        )
      );
    } else if (item.packageId) {
      queries.push(
        adjustPackageStockQuery(
          database,
          { packageId: item.packageId, delta: item.quantity },
          "create",
          { now }
        )
      );
    }
  }

  // 2. Tandai pesanan seragam sebagai superseded
  queries.push(
    database
      .update(uniformOrders)
      .set({
        shipmentStatus: "superseded",
        supersededByOrderId: input.supersededByOrderId ?? null,
        updatedAt: now,
      })
      .where(eq(uniformOrders.id, order.id))
  );

  return { ok: true, queries, order };
}

/**
 * Eksekusi supersede pesanan seragam secara atomik.
 */
export async function supersedeUniformOrder(
  database: AppDatabase,
  input: SupersedeUniformOrderInput,
  deps: WriteDeps = {}
): Promise<SupersedeOrderResult> {
  const prepared = await buildSupersedeUniformOrderQueries(database, input, deps);
  if (!prepared.ok) return prepared;

  try {
    await runWriteBatch(database, prepared.queries);
    return {
      ok: true,
      orderId: prepared.order.id,
      supersededByOrderId: input.supersededByOrderId,
    };
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "supersede pesanan seragam");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
}

export interface PendingStudentOrders {
  bookOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    paymentStatus: string;
    fulfillmentStatus: string;
    createdAt: string;
  } | null;
  uniformOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    paymentStatus: string;
    shipmentStatus: string;
    createdAt: string;
  } | null;
}

/**
 * Mencari pesanan aktif gantung (buku dan/atau seragam) untuk seorang siswa.
 * Dipakai oleh intake portal publik sebelum submit untuk mendeteksi revisi pesanan gantung.
 */
export async function findPendingOrdersForStudent(
  database: AppDatabase,
  studentId: string
): Promise<PendingStudentOrders> {
  const bookOrders = await database
    .select({
      id: studentBookOrders.id,
      orderNumber: studentBookOrders.orderNumber,
      totalAmount: studentBookOrders.totalAmount,
      paidAmount: studentBookOrders.paidAmount,
      paymentStatus: studentBookOrders.paymentStatus,
      fulfillmentStatus: studentBookOrders.fulfillmentStatus,
      createdAt: studentBookOrders.createdAt,
    })
    .from(studentBookOrders)
    .where(eq(studentBookOrders.studentId, studentId));

  const pendingBook = bookOrders.find((o) => isBookOrderPending(o)) ?? null;

  const uniformOrdersList = await database
    .select({
      id: uniformOrders.id,
      orderNumber: uniformOrders.orderNumber,
      totalAmount: uniformOrders.totalAmount,
      paidAmount: uniformOrders.paidAmount,
      paymentStatus: uniformOrders.paymentStatus,
      shipmentStatus: uniformOrders.shipmentStatus,
      shippingResi: uniformOrders.shippingResi,
      createdAt: uniformOrders.createdAt,
    })
    .from(uniformOrders)
    .where(eq(uniformOrders.studentId, studentId));

  const pendingUniform = uniformOrdersList.find((o) => isUniformOrderPending(o)) ?? null;

  return {
    bookOrder: pendingBook,
    uniformOrder: pendingUniform
      ? {
          id: pendingUniform.id,
          orderNumber: pendingUniform.orderNumber,
          totalAmount: pendingUniform.totalAmount,
          paidAmount: pendingUniform.paidAmount,
          paymentStatus: pendingUniform.paymentStatus,
          shipmentStatus: pendingUniform.shipmentStatus,
          createdAt: pendingUniform.createdAt,
        }
      : null,
  };
}

/**
 * Helper predikat kanonik untuk memeriksa apakah pesanan buku masih gantung (layak diganti).
 */
export function isBookOrderPending(order: { fulfillmentStatus: string }): boolean {
  return order.fulfillmentStatus !== "picked_up" && order.fulfillmentStatus !== "superseded";
}

/**
 * Helper predikat kanonik untuk memeriksa apakah pesanan seragam masih gantung (layak diganti).
 */
export function isUniformOrderPending(order: { shipmentStatus: string; shippingResi?: string | null }): boolean {
  return order.shipmentStatus === "belum_dikirim" && !order.shippingResi;
}
