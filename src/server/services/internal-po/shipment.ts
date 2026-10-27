import { desc, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  bookPackages,
  internalPurchaseOrderItems,
  internalPurchaseOrders,
  internalShipmentItems,
  internalShipments,
  schools,
} from "../../../db/schema";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";
import type { InternalShipmentItemInput } from "./po";

export interface OutstandingPoLine {
  id: string;
  packageId: string;
  packageName: string | null;
  packageCode: string | null;
  quantityOrdered: number;
  quantityFulfilled: number;
  quantityRemaining: number;
}

export interface OutstandingPoRow {
  id: string;
  poNumber: string;
  schoolId: string;
  schoolName: string;
  status: string;
  createdAt: string;
  items: OutstandingPoLine[];
}

export interface CreateManualShipmentInput {
  destinationSchoolId: string;
  deliveryNoteNumber: string;
  shippedDate?: string;
  notes?: string;
  transferShipmentId?: string;
  items: InternalShipmentItemInput[];
}

export type CreateManualShipmentResult =
  | { ok: true; data: { shipmentId: string } }
  | { ok: false; status: 400 | 404; message: string };

/**
 * Mengambil daftar PO cabang yang belum selesai dipenuhi (submitted / partial_fulfilled)
 * beserta sisa item (quantityRemaining > 0) untuk saran penerbitan Surat Jalan.
 */
export async function listOutstandingPOs(
  database: AppDatabase,
  schoolId?: string,
  limit = 100
): Promise<OutstandingPoRow[]> {
  const activeOrders = await database
    .select({
      id: internalPurchaseOrders.id,
      poNumber: internalPurchaseOrders.poNumber,
      schoolId: internalPurchaseOrders.schoolId,
      schoolName: schools.name,
      status: internalPurchaseOrders.status,
      createdAt: internalPurchaseOrders.createdAt,
    })
    .from(internalPurchaseOrders)
    .innerJoin(schools, eq(internalPurchaseOrders.schoolId, schools.id))
    .where(
      schoolId
        ? eq(internalPurchaseOrders.schoolId, schoolId)
        : inArray(internalPurchaseOrders.status, ["submitted", "partial_fulfilled"])
    )
    .orderBy(desc(internalPurchaseOrders.createdAt))
    .limit(limit);

  // Jika difilter per schoolId, pastikan statusnya memang belum selesai
  const outstandingOrders = schoolId
    ? activeOrders.filter((o) => o.status === "submitted" || o.status === "partial_fulfilled")
    : activeOrders;

  const orderIds = outstandingOrders.map((o) => o.id);
  if (orderIds.length === 0) return [];

  const items = await database
    .select({
      id: internalPurchaseOrderItems.id,
      internalPoId: internalPurchaseOrderItems.internalPoId,
      packageId: internalPurchaseOrderItems.packageId,
      packageName: bookPackages.name,
      packageCode: bookPackages.code,
      quantityOrdered: internalPurchaseOrderItems.quantityOrdered,
      quantityFulfilled: internalPurchaseOrderItems.quantityFulfilled,
    })
    .from(internalPurchaseOrderItems)
    .innerJoin(bookPackages, eq(internalPurchaseOrderItems.packageId, bookPackages.id))
    .where(inArray(internalPurchaseOrderItems.internalPoId, orderIds));

  const itemsByPo = new Map<string, OutstandingPoLine[]>();
  for (const it of items) {
    const fulfilled = it.quantityFulfilled ?? 0;
    const remaining = Math.max(0, it.quantityOrdered - fulfilled);
    const line: OutstandingPoLine = {
      id: it.id,
      packageId: it.packageId,
      packageName: it.packageName,
      packageCode: it.packageCode,
      quantityOrdered: it.quantityOrdered,
      quantityFulfilled: fulfilled,
      quantityRemaining: remaining,
    };
    const list = itemsByPo.get(it.internalPoId) ?? [];
    list.push(line);
    itemsByPo.set(it.internalPoId, list);
  }

  return outstandingOrders
    .map((o) => ({
      ...o,
      items: itemsByPo.get(o.id) ?? [],
    }))
    .filter((o) => o.items.some((i) => i.quantityRemaining > 0));
}

/**
 * Menerbitkan Surat Jalan manual pengiriman gudang ke cabang tanpa referensi nomor PO.
 */
export async function createManualShipment(
  database: AppDatabase,
  input: CreateManualShipmentInput,
  deps: { now?: () => string; generateId?: () => string } = {}
): Promise<CreateManualShipmentResult> {
  if (!input.destinationSchoolId) {
    return { ok: false, status: 400, message: "Cabang tujuan wajib dipilih" };
  }
  if (!input.deliveryNoteNumber?.trim()) {
    return { ok: false, status: 400, message: "Nomor Surat Jalan pengiriman internal wajib diisi" };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, status: 400, message: "Minimal 1 item yang dikirim" };
  }
  const bad = input.items.find((it) => !Number.isInteger(it.quantity) || it.quantity < 1);
  if (bad) return { ok: false, status: 400, message: "Kuantitas minimal 1" };

  const [destSchool] = await database.select().from(schools).where(eq(schools.id, input.destinationSchoolId));
  if (!destSchool) return { ok: false, status: 404, message: "Cabang tujuan tidak ditemukan" };

  const now = (deps.now ?? (() => new Date().toISOString()))();
  const shipmentId = (deps.generateId ?? (() => crypto.randomUUID()))();
  const genItemId = () => crypto.randomUUID();

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

  try {
    await runWriteBatch(database, [
      database.insert(internalShipments).values({
        id: shipmentId,
        internalPoId: null,
        destinationSchoolId: input.destinationSchoolId,
        deliveryNoteNumber: input.deliveryNoteNumber.trim(),
        transferShipmentId: input.transferShipmentId || null,
        shippedDate: input.shippedDate || now.split("T")[0],
        status: "in_transit",
        notes: input.notes || null,
        createdAt: now,
        updatedAt: now,
      }),
      ...chunkRows(shipmentItemRows).map((chunk) => database.insert(internalShipmentItems).values(chunk)),
    ]);
  } catch (err) {
    const mapped = d1WriteErrorStatus(err, "menerbitkan Surat Jalan manual");
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }

  return { ok: true, data: { shipmentId } };
}
