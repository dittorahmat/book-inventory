import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import { uniformOrderItems, uniformOrders, uniformRefunds } from "../../../db/schema";
import {
  d1WriteErrorStatus,
  newWriteId,
  writeNow,
  type WriteDeps,
} from "../../lib/d1-write";
import { documentNumber, randomSerial } from "../../lib/document-number";
import type { UniformError } from "./catalog";
import { adjustPackageStockQuery, adjustVariantStockQuery } from "./stock";

/**
 * Siklus hidup Refund Seragam (barang cacat / gagal kirim). Tukar ukuran
 * tinggal di `uniform/exchange` — satu mesin status, satu pemilik mutasi stok.
 */

const invalid = (message: string): UniformError => ({ ok: false, status: 400, message });

type OrderRow = typeof uniformOrders.$inferSelect;
type RefundRow = typeof uniformRefunds.$inferSelect;

async function loadOrder(database: AppDatabase, orderId: string): Promise<OrderRow | null> {
  const [order]: OrderRow[] = await database.select().from(uniformOrders).where(eq(uniformOrders.id, orderId));
  return order ?? null;
}

export interface RefundRequestInput {
  orderId: string;
  amount?: number;
  reason: string;
}

/**
 * Pemilik kolom `uniform_refunds.status` untuk pencairan Finance (ADR-0019):
 * Finance menyusun uangnya, transisi status tetap milik modul refund seragam.
 */
export const markUniformRefundRefundedQuery = (
  database: AppDatabase,
  target: { refundId?: string | null; orderId: string },
  now: string
) =>
  database
    .update(uniformRefunds)
    .set({ status: "refunded", updatedAt: now })
    .where(target.refundId ? eq(uniformRefunds.id, target.refundId) : eq(uniformRefunds.orderId, target.orderId));

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
  const refundNumber = documentNumber("RFD-U", now.slice(0, 10).replaceAll("-", ""), randomSerial(6));
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
      await adjustVariantStockQuery(
        database,
        { variantId: item.variantId, size: item.size, delta: item.quantity },
        "create",
        { now }
      );
    } else if (item.packageId) {
      // Paket refund tidak membuat baris stok paket yang hilang (perilaku lama).
      await adjustPackageStockQuery(
        database,
        { packageId: item.packageId, delta: item.quantity },
        "skip",
        { now }
      );
    }
  }
  return setStatus("refunded");
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
