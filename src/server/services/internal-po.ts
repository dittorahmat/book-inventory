import { eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../db";
import {
  bookPackages,
  internalPurchaseOrderItems,
  internalPurchaseOrders,
  internalShipmentItems,
  internalShipments,
  schools,
} from "../../db/schema";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "../lib/d1-write";

export interface InternalPoItemInput {
  packageId: string;
  quantityOrdered: number;
}

export interface CreateInternalPoInput {
  schoolId: string;
  notes?: string;
  items: InternalPoItemInput[];
}

export interface InternalPoDeps {
  now?: () => string;
  generateId?: () => string;
  generatePoNumber?: (nowIso: string) => string;
  generateItemId?: () => string;
}

export type CreateInternalPoResult =
  | { ok: true; data: { id: string; poNumber: string } }
  | { ok: false; status: 400 | 404; message: string };

export interface InternalShipmentItemInput {
  packageId?: string;
  packageItemId?: string;
  bookId?: string;
  quantity: number;
  isOutstandingFollowup?: boolean;
}

export interface FulfillInternalPoInput {
  deliveryNoteNumber: string;
  shippedDate?: string;
  notes?: string;
  items: InternalShipmentItemInput[];
}

export type FulfillInternalPoResult =
  | { ok: true; data: { shipmentId: string; status: string } }
  | { ok: false; status: 400 | 404; message: string };

type InternalPoItemRow = typeof internalPurchaseOrderItems.$inferSelect;

const validateCreateLines = (items: InternalPoItemInput[]): string | null => {
  if (!Array.isArray(items) || items.length === 0) return "Minimal 1 paket yang dipesan";
  const bad = items.find(
    (it) => !it.packageId || !Number.isInteger(it.quantityOrdered) || it.quantityOrdered < 1
  );
  return !bad ? null : !bad.packageId ? "Paket buku wajib dipilih" : "Kuantitas minimal 1";
};

const validateShipmentLines = (items: InternalShipmentItemInput[]): string | null => {
  if (!Array.isArray(items) || items.length === 0) return "Minimal 1 item yang dikirim";
  const bad = items.find((it) => !Number.isInteger(it.quantity) || it.quantity < 1);
  return bad ? "Kuantitas minimal 1" : null;
};

/**
 * Deep module: Internal PO cabang → gudang meniru pola Transfer Shipment write.
 * Satu interface memiliki validasi pra-tulis, transisi status
 * (`submitted → partial_fulfilled → completed`), dan tulis induk+anak atomik
 * via seam `lib/d1-write` (batch di D1, sekuensial di bun-sqlite, chunk 10 baris).
 */
export async function createInternalPo(
  database: AppDatabase,
  input: CreateInternalPoInput,
  deps: InternalPoDeps = {}
): Promise<CreateInternalPoResult> {
  if (!input.schoolId) return { ok: false, status: 400, message: "Cabang pemesan wajib dipilih" };
  const lineError = validateCreateLines(input.items);
  if (lineError) return { ok: false, status: 400, message: lineError };

  const [school] = await database.select().from(schools).where(eq(schools.id, input.schoolId));
  if (!school) return { ok: false, status: 404, message: "Sekolah/gudang tidak ditemukan" };

  const packageIds = [...new Set(input.items.map((it) => it.packageId))];
  const pkgRows =
    packageIds.length > 0
      ? await database.select({ id: bookPackages.id }).from(bookPackages).where(inArray(bookPackages.id, packageIds))
      : [];
  const knownPackages = new Set(pkgRows.map((r: { id: string }) => r.id));
  const missing = packageIds.find((pid) => !knownPackages.has(pid));
  if (missing) return { ok: false, status: 400, message: `Paket dengan ID ${missing} tidak ditemukan` };

  const now = (deps.now ?? (() => new Date().toISOString()))();
  const id = (deps.generateId ?? (() => crypto.randomUUID()))();
  const poNumber =
    deps.generatePoNumber?.(now) ??
    `IPO-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
  const genItemId = deps.generateItemId ?? (() => crypto.randomUUID());
  const itemRows = input.items.map((item) => ({
    id: genItemId(),
    internalPoId: id,
    packageId: item.packageId,
    quantityOrdered: item.quantityOrdered,
    quantityFulfilled: 0,
    createdAt: now,
  }));

  try {
    await runWriteBatch(database, [
      database.insert(internalPurchaseOrders).values({
        id,
        poNumber,
        schoolId: input.schoolId,
        status: "submitted",
        notes: input.notes || null,
        createdByUserId: null,
        createdAt: now,
        updatedAt: now,
      }),
      ...chunkRows(itemRows).map((chunk) => database.insert(internalPurchaseOrderItems).values(chunk)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "membuat PO Internal");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  return { ok: true, data: { id, poNumber } };
}

export async function fulfillInternalPo(
  database: AppDatabase,
  poId: string,
  input: FulfillInternalPoInput,
  deps: InternalPoDeps = {}
): Promise<FulfillInternalPoResult> {
  if (!input.deliveryNoteNumber?.trim()) {
    return { ok: false, status: 400, message: "Nomor Surat Jalan pengiriman internal wajib diisi" };
  }
  const lineError = validateShipmentLines(input.items);
  if (lineError) return { ok: false, status: 400, message: lineError };

  const [po] = await database.select().from(internalPurchaseOrders).where(eq(internalPurchaseOrders.id, poId));
  if (!po) return { ok: false, status: 404, message: "PO Internal tidak ditemukan" };

  const now = (deps.now ?? (() => new Date().toISOString()))();
  const shipmentId = (deps.generateId ?? (() => crypto.randomUUID()))();
  const genItemId = deps.generateItemId ?? (() => crypto.randomUUID());

  const currentPoItems = await database
    .select()
    .from(internalPurchaseOrderItems)
    .where(eq(internalPurchaseOrderItems.internalPoId, poId));
  const poItemMap = new Map<string, InternalPoItemRow>(currentPoItems.map((it: InternalPoItemRow) => [it.packageId, it]));
  const fulfilled = new Map<string, number>(currentPoItems.map((it: InternalPoItemRow) => [it.id, it.quantityFulfilled ?? 0]));
  for (const item of input.items) {
    if (!item.packageId) continue;
    const poItem = poItemMap.get(item.packageId);
    if (poItem) fulfilled.set(poItem.id, Math.min(poItem.quantityOrdered, (fulfilled.get(poItem.id) ?? 0) + item.quantity));
  }

  const shipmentItemRows = input.items.map((item) => ({
    id: genItemId(),
    shipmentId,
    packageId: item.packageId || null,
    packageItemId: item.packageItemId || null,
    bookId: item.bookId || null,
    quantity: item.quantity,
    isOutstandingFollowup: item.isOutstandingFollowup ?? false,
    createdAt: now,
  }));
  const originalFulfilled = new Map<string, number>(currentPoItems.map((it: InternalPoItemRow) => [it.id, it.quantityFulfilled ?? 0]));
  const progressUpdates = [...fulfilled.entries()]
    .filter(([id, qty]) => qty !== (originalFulfilled.get(id) ?? 0))
    .map(([id, quantityFulfilled]) =>
      database.update(internalPurchaseOrderItems).set({ quantityFulfilled }).where(eq(internalPurchaseOrderItems.id, id))
    );
  const nextStatus = [...fulfilled.entries()].every(([id, qty]) => {
    const ordered = currentPoItems.find((it: InternalPoItemRow) => it.id === id)?.quantityOrdered ?? 0;
    return qty >= ordered;
  })
    ? "completed"
    : "partial_fulfilled";

  try {
    await runWriteBatch(database, [
      database.insert(internalShipments).values({
        id: shipmentId,
        internalPoId: poId,
        deliveryNoteNumber: input.deliveryNoteNumber.trim(),
        shippedDate: input.shippedDate || now.split("T")[0],
        status: "in_transit",
        notes: input.notes || null,
        createdAt: now,
        updatedAt: now,
      }),
      ...chunkRows(shipmentItemRows).map((chunk) => database.insert(internalShipmentItems).values(chunk)),
      ...progressUpdates,
      database.update(internalPurchaseOrders).set({ status: nextStatus, updatedAt: now }).where(eq(internalPurchaseOrders.id, poId)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "menerbitkan Surat Jalan");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
  return { ok: true, data: { shipmentId, status: nextStatus } };
}
