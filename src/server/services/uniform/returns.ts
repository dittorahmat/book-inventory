import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  uniformVariants,
  uniformSizes,
  uniformStock,
  uniformOrders,
  uniformOrderItems,
  uniformPackageBom,
  uniformPackageStock,
  uniformExchanges,
  uniformRefunds,
} from "../../../db/schema";
import {
  d1WriteErrorStatus,
  newWriteId,
  runWriteBatch,
  writeNow,
  type WriteDeps,
} from "../../lib/d1-write";
import { documentNumber } from "../../lib/document-number";
import type { UniformError } from "./catalog";

/** Batas tukar ukuran (hari sejak order dibuat). */
export const EXCHANGE_WINDOW_DAYS = 14;

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });

type OrderRow = typeof uniformOrders.$inferSelect;
type ExchangeRow = typeof uniformExchanges.$inferSelect;
type RefundRow = typeof uniformRefunds.$inferSelect;

async function loadOrder(database: AppDatabase, orderId: string): Promise<OrderRow | null> {
  const [order]: OrderRow[] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  return order ?? null;
}

async function orderHasVariant(
  database: AppDatabase,
  orderId: string,
  variantId: string,
  size: string
): Promise<boolean> {
  const items: Array<typeof uniformOrderItems.$inferSelect> = await database
    .select()
    .from(uniformOrderItems)
    .where(eq(uniformOrderItems.orderId, orderId));
  if (items.some((i) => i.variantId === variantId && i.size === size)) return true;
  const packageIds = [...new Set(items.filter((i) => i.packageId).map((i) => i.packageId as string))];
  if (packageIds.length === 0) return false;
  const bom: Array<{ variantId: string }> = await database
    .select({ variantId: uniformPackageBom.variantId })
    .from(uniformPackageBom)
    .where(inArray(uniformPackageBom.packageId, packageIds));
  return bom.some((b) => b.variantId === variantId);
}

export interface ExchangeRequestInput {
  orderId: string;
  oldVariantId: string;
  oldSize: string;
  newVariantId: string;
  newSize: string;
  reason: string;
}

export async function requestUniformExchange(
  database: AppDatabase,
  input: ExchangeRequestInput,
  deps?: WriteDeps
): Promise<{ ok: true; data: ExchangeRow } | UniformError> {
  const now = writeNow(deps);
  if (!input.reason.trim()) return invalid("Alasan tukar wajib diisi.");
  const order = await loadOrder(database, input.orderId);
  if (!order) return { ok: false, status: 404, message: "Order seragam tidak ditemukan." };
  const ageDays = (Date.parse(now) - Date.parse(order.createdAt)) / 86400000;
  if (ageDays > EXCHANGE_WINDOW_DAYS) return invalid(`Tukar ukuran maksimal ${EXCHANGE_WINDOW_DAYS} hari sejak order.`);

  const variants: Array<typeof uniformVariants.$inferSelect> = await database
    .select()
    .from(uniformVariants)
    .where(inArray(uniformVariants.id, [input.oldVariantId, input.newVariantId]));
  const oldV = variants.find((v) => v.id === input.oldVariantId);
  const newV = variants.find((v) => v.id === input.newVariantId);
  if (!oldV || !newV) return invalid("Varian lama/baru tidak dikenal.");
  if (oldV.kind === "kain_harian" || newV.kind === "kain_harian") {
    return invalid("Kain yang sudah dipotong tidak bisa tukar ukuran — ajukan refund bila cacat.");
  }
  const allowed = await database
    .select()
    .from(uniformSizes)
    .where(and(eq(uniformSizes.variantId, input.newVariantId), eq(uniformSizes.size, input.newSize)));
  if (allowed.length === 0) return invalid(`Size ${input.newSize} tidak terdaftar untuk varian tersebut.`);
  if (!(await orderHasVariant(database, input.orderId, input.oldVariantId, input.oldSize))) {
    return invalid("Item yang ditukar tidak ada di order tersebut.");
  }

  const id = newWriteId(deps);
  try {
    await database.insert(uniformExchanges).values({
      id, orderId: input.orderId, studentId: order.studentId,
      oldVariantId: input.oldVariantId, oldSize: input.oldSize,
      newVariantId: input.newVariantId, newSize: input.newSize,
      reason: input.reason.trim(), status: "requested", createdAt: now, updatedAt: now,
    });
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "mencatat tukar ukuran");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  const [created]: ExchangeRow[] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, id));
  return { ok: true, data: created };
}

export async function resolveUniformExchange(
  database: AppDatabase,
  exchangeId: string,
  action: "approve" | "complete" | "reject",
  handledByUserId?: string,
  deps?: WriteDeps
): Promise<{ ok: true; data: ExchangeRow } | UniformError> {
  const now = writeNow(deps);
  const [ex]: ExchangeRow[] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, exchangeId));
  if (!ex) return { ok: false, status: 404, message: "Pengajuan tukar tidak ditemukan." };
  const setStatus = async (status: ExchangeRow["status"]) => {
    await database
      .update(uniformExchanges)
      .set({ status, handledByUserId: handledByUserId ?? null, resolvedAt: status === "requested" ? null : now, updatedAt: now })
      .where(eq(uniformExchanges.id, exchangeId));
    const [updated]: ExchangeRow[] = await database.select().from(uniformExchanges).where(eq(uniformExchanges.id, exchangeId));
    return { ok: true as const, data: updated };
  };

  if (action === "reject") {
    if (ex.status !== "requested") return invalid("Hanya pengajuan baru yang bisa ditolak.");
    return setStatus("rejected");
  }
  if (action === "approve") {
    if (ex.status !== "requested") return invalid("Hanya pengajuan baru yang bisa disetujui.");
    const [stock] = await database
      .select()
      .from(uniformStock)
      .where(and(eq(uniformStock.variantId, ex.newVariantId), eq(uniformStock.size, ex.newSize)));
    if (!stock || stock.quantity < 1) return invalid("Stok size pengganti tidak tersedia.");
    return setStatus("approved");
  }
  if (ex.status !== "approved") return invalid("Hanya pengajuan yang disetujui yang bisa diselesaikan.");
  // Tulis sekuensial (§10): stok baru keluar, stok lama kembali.
  const [fresh] = await database
    .select()
    .from(uniformStock)
    .where(and(eq(uniformStock.variantId, ex.newVariantId), eq(uniformStock.size, ex.newSize)));
  if (!fresh || fresh.quantity < 1) return invalid("Stok size pengganti habis.");
  const [oldStock] = await database
    .select()
    .from(uniformStock)
    .where(and(eq(uniformStock.variantId, ex.oldVariantId), eq(uniformStock.size, ex.oldSize)));
  const writes: unknown[] = [
    database.update(uniformStock).set({ quantity: fresh.quantity - 1, updatedAt: now }).where(eq(uniformStock.id, fresh.id)),
    oldStock
      ? database.update(uniformStock).set({ quantity: oldStock.quantity + 1, updatedAt: now }).where(eq(uniformStock.id, oldStock.id))
      : database.insert(uniformStock).values({ id: newWriteId(deps), variantId: ex.oldVariantId, size: ex.oldSize, quantity: 1, updatedAt: now }),
  ];
  await runWriteBatch(database, writes);
  return setStatus("completed");
}

export interface RefundRequestInput {
  orderId: string;
  amount?: number;
  reason: string;
}

export async function requestUniformRefund(
  database: AppDatabase,
  input: RefundRequestInput,
  deps?: WriteDeps
): Promise<{ ok: true; data: RefundRow } | UniformError> {
  const now = writeNow(deps);
  if (!input.reason.trim()) return invalid("Alasan refund wajib diisi.");
  const order = await loadOrder(database, input.orderId);
  if (!order) return { ok: false, status: 404, message: "Order seragam tidak ditemukan." };
  const amount = input.amount ?? order.totalAmount;
  if (amount < 1 || amount > order.totalAmount) return invalid("Nominal refund melebihi total order.");
  const id = newWriteId(deps);
  const refundNumber = documentNumber("RFD-U", now.slice(0, 10).replaceAll("-", ""), Math.floor(Math.random() * 900 + 100));
  try {
    await database.insert(uniformRefunds).values({
      id, refundNumber, orderId: input.orderId, studentId: order.studentId,
      amount, reason: input.reason.trim(), status: "requested", createdAt: now, updatedAt: now,
    });
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "mencatat refund seragam");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  const [created]: RefundRow[] = await database.select().from(uniformRefunds).where(eq(uniformRefunds.id, id));
  return { ok: true, data: created };
}

export async function resolveUniformRefund(
  database: AppDatabase,
  refundId: string,
  action: "approve" | "refund" | "reject",
  handledByUserId?: string,
  deps?: WriteDeps
): Promise<{ ok: true; data: RefundRow } | UniformError> {
  const now = writeNow(deps);
  const [rf]: RefundRow[] = await database.select().from(uniformRefunds).where(eq(uniformRefunds.id, refundId));
  if (!rf) return { ok: false, status: 404, message: "Pengajuan refund tidak ditemukan." };
  const setStatus = async (status: RefundRow["status"]) => {
    await database
      .update(uniformRefunds)
      .set({ status, handledByUserId: handledByUserId ?? null, resolvedAt: status === "requested" ? null : now, updatedAt: now })
      .where(eq(uniformRefunds.id, refundId));
    const [updated]: RefundRow[] = await database.select().from(uniformRefunds).where(eq(uniformRefunds.id, refundId));
    return { ok: true as const, data: updated };
  };
  if (action === "reject") {
    if (rf.status !== "requested") return invalid("Hanya pengajuan baru yang bisa ditolak.");
    return setStatus("rejected");
  }
  if (action === "approve") {
    if (rf.status !== "requested") return invalid("Hanya pengajuan baru yang bisa disetujui.");
    return setStatus("approved");
  }
  if (rf.status !== "approved") return invalid("Hanya pengajuan yang disetujui yang bisa direfund.");
  // Kembalikan stok baris order (satuan ke uniform_stock, paket ke package_stock), sekuensial.
  const items: Array<typeof uniformOrderItems.$inferSelect> = await database
    .select()
    .from(uniformOrderItems)
    .where(eq(uniformOrderItems.orderId, rf.orderId));
  for (const item of items) {
    if (item.variantId) {
      const [stock] = await database
        .select()
        .from(uniformStock)
        .where(and(eq(uniformStock.variantId, item.variantId), eq(uniformStock.size, item.size)));
      if (stock) {
        await database.update(uniformStock).set({ quantity: stock.quantity + item.quantity, updatedAt: now }).where(eq(uniformStock.id, stock.id));
      } else {
        await database.insert(uniformStock).values({ id: newWriteId(deps), variantId: item.variantId, size: item.size, quantity: item.quantity, updatedAt: now });
      }
    } else if (item.packageId) {
      const [ready] = await database.select().from(uniformPackageStock).where(eq(uniformPackageStock.packageId, item.packageId));
      if (ready) {
        await database.update(uniformPackageStock).set({ quantity: ready.quantity + item.quantity, updatedAt: now }).where(eq(uniformPackageStock.id, ready.id));
      }
    }
  }
  return setStatus("refunded");
}

export async function listUniformExchanges(database: AppDatabase, schoolId?: string, status?: string): Promise<ExchangeRow[]> {
  // Seluruh filter di WHERE SQL + LIMIT (§11): join order untuk partisi sekolah.
  if (schoolId) {
    const conditions = [eq(uniformOrders.schoolId, schoolId)];
    if (status) conditions.push(eq(uniformExchanges.status, status as ExchangeRow["status"]));
    const rows = await database
      .select({ ex: uniformExchanges })
      .from(uniformExchanges)
      .innerJoin(uniformOrders, eq(uniformExchanges.orderId, uniformOrders.id))
      .where(and(...conditions))
      .limit(50);
    return rows.map((r: { ex: ExchangeRow }) => r.ex);
  }
  if (status) {
    return (await database
      .select()
      .from(uniformExchanges)
      .where(eq(uniformExchanges.status, status as ExchangeRow["status"]))
      .limit(50)) as ExchangeRow[];
  }
  return (await database.select().from(uniformExchanges).limit(50)) as ExchangeRow[];
}

export async function listUniformRefunds(database: AppDatabase, schoolId?: string, status?: string): Promise<RefundRow[]> {
  if (schoolId) {
    const conditions = [eq(uniformOrders.schoolId, schoolId)];
    if (status) conditions.push(eq(uniformRefunds.status, status as RefundRow["status"]));
    const rows = await database
      .select({ rf: uniformRefunds })
      .from(uniformRefunds)
      .innerJoin(uniformOrders, eq(uniformRefunds.orderId, uniformOrders.id))
      .where(and(...conditions))
      .limit(50);
    return rows.map((r: { rf: RefundRow }) => r.rf);
  }
  if (status) {
    return (await database
      .select()
      .from(uniformRefunds)
      .where(eq(uniformRefunds.status, status as RefundRow["status"]))
      .limit(50)) as RefundRow[];
  }
  return (await database.select().from(uniformRefunds).limit(50)) as RefundRow[];
}
