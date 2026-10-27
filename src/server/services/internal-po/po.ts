import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../db";
import {
  bookPackages,
  books,
  internalPurchaseOrderItems,
  internalPurchaseOrders,
  internalShipmentItems,
  internalShipments,
  schools,
  students,
} from "../../../db/schema";
import { chunkRows, d1WriteErrorStatus, runWriteBatch } from "../../lib/d1-write";
import { documentNumber, epochTimeFragment, randomSerial } from "../../lib/document-number";
import type {
  CreateInternalPoInput,
  CreateInternalPoResult,
  FulfillInternalPoInput,
  FulfillInternalPoResult,
  InternalPoDeps,
  InternalPoItemInput,
  InternalPoListItem,
  InternalPoListRow,
  InternalShipmentItemInput,
  InternalShipmentListItem,
  InternalShipmentListRow,
  ListInternalShipmentsResult,
} from "./types";

export type {
  CreateInternalPoInput,
  CreateInternalPoResult,
  FulfillInternalPoInput,
  FulfillInternalPoResult,
  InternalPoDeps,
  InternalPoItemInput,
  InternalPoListItem,
  InternalPoListRow,
  InternalShipmentItemInput,
  InternalShipmentListItem,
  InternalShipmentListRow,
  ListInternalShipmentsResult,
};

type InternalPoItemRow = typeof internalPurchaseOrderItems.$inferSelect;

/**
 * Satu-satunya pemilik bacaan daftar Internal PO beserta baris paketnya:
 * join + pengelompokan per PO tinggal di sini agar route hanya validasi +
 * scope. Filter cabang di WHERE SQL, LIMIT di server (§11).
 */
export const listInternalPOs = async (
  database: AppDatabase,
  schoolId?: string,
  limit = 100
): Promise<InternalPoListRow[]> => {
  const orders = await database
    .select({
      id: internalPurchaseOrders.id,
      poNumber: internalPurchaseOrders.poNumber,
      schoolId: internalPurchaseOrders.schoolId,
      schoolName: schools.name,
      status: internalPurchaseOrders.status,
      notes: internalPurchaseOrders.notes,
      createdAt: internalPurchaseOrders.createdAt,
      updatedAt: internalPurchaseOrders.updatedAt,
    })
    .from(internalPurchaseOrders)
    .innerJoin(schools, eq(internalPurchaseOrders.schoolId, schools.id))
    .where(schoolId ? eq(internalPurchaseOrders.schoolId, schoolId) : undefined)
    .orderBy(desc(internalPurchaseOrders.createdAt))
    .limit(limit);

  const orderIds = orders.map((o: { id: string }) => o.id);
  const allItems: InternalPoListItem[] =
    orderIds.length > 0
      ? await database
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
          .where(inArray(internalPurchaseOrderItems.internalPoId, orderIds))
      : [];

  const itemsByPo = new Map<string, InternalPoListItem[]>();
  for (const it of allItems) {
    const list = itemsByPo.get(it.internalPoId) ?? [];
    list.push(it);
    itemsByPo.set(it.internalPoId, list);
  }

  return orders.map((o: (typeof orders)[number]) => ({ ...o, items: itemsByPo.get(o.id) ?? [] }));
};

/**
 * Satu-satunya pemilik bacaan histori Surat Jalan Internal beserta
 * barisnya: 404 milik seam agar pemanggil langsung aman tanpa fetch ganda.
 */
export const listInternalShipments = async (
  database: AppDatabase,
  poId: string,
  limit = 100
): Promise<ListInternalShipmentsResult> => {
  const [po] = await database.select().from(internalPurchaseOrders).where(eq(internalPurchaseOrders.id, poId));
  if (!po) return { ok: false, status: 404, message: "PO Internal tidak ditemukan" };

  const shipments = await database
    .select()
    .from(internalShipments)
    .where(eq(internalShipments.internalPoId, poId))
    .orderBy(desc(internalShipments.createdAt))
    .limit(limit);

  const shipmentIds = shipments.map((s: { id: string }) => s.id);
  const shipmentItemsList: InternalShipmentListItem[] =
    shipmentIds.length > 0
      ? await database
          .select({
            id: internalShipmentItems.id,
            shipmentId: internalShipmentItems.shipmentId,
            packageId: internalShipmentItems.packageId,
            packageName: bookPackages.name,
            bookId: internalShipmentItems.bookId,
            bookTitle: books.title,
            quantity: internalShipmentItems.quantity,
            isOutstandingFollowup: internalShipmentItems.isOutstandingFollowup,
            receivedCondition: internalShipmentItems.receivedCondition,
            receivedNotes: internalShipmentItems.receivedNotes,
          })
          .from(internalShipmentItems)
          .leftJoin(bookPackages, eq(internalShipmentItems.packageId, bookPackages.id))
          .leftJoin(books, eq(internalShipmentItems.bookId, books.id))
          .where(inArray(internalShipmentItems.shipmentId, shipmentIds))
      : [];

  const itemsByShipment = new Map<string, InternalShipmentListItem[]>();
  for (const it of shipmentItemsList) {
    const list = itemsByShipment.get(it.shipmentId) ?? [];
    list.push(it);
    itemsByShipment.set(it.shipmentId, list);
  }

  return {
    ok: true,
    data: shipments.map((s: (typeof shipments)[number]) => ({ ...s, items: itemsByShipment.get(s.id) ?? [] })),
  };
};

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
      ? await database
          .select({ id: bookPackages.id, name: bookPackages.name, gradeLevel: bookPackages.gradeLevel })
          .from(bookPackages)
          .where(inArray(bookPackages.id, packageIds))
      : [];
  const knownPackages = new Map(pkgRows.map((r) => [r.id, r]));
  const missing = packageIds.find((pid) => !knownPackages.has(pid));
  if (missing) return { ok: false, status: 400, message: `Paket dengan ID ${missing} tidak ditemukan` };

  // Capping kuota pesanan cabang: Jumlah pesanan paket tidak boleh melebihi siswa aktif cabang di jenjang tsb
  for (const item of input.items) {
    const pkg = knownPackages.get(item.packageId);
    if (pkg?.gradeLevel) {
      const [countResult] = await database
        .select({ count: sql<number>`count(*)` })
        .from(students)
        .where(
          and(
            eq(students.schoolId, input.schoolId),
            eq(students.gradeLevel, pkg.gradeLevel),
            eq(students.status, "active")
          )
        );
      const studentCount = Number(countResult?.count ?? 0);
      // Jika data siswa di cabang untuk jenjang ini ada, batasi maksimal pesanan sebesar jumlah siswa tersebut
      if (studentCount > 0 && item.quantityOrdered > studentCount) {
        return {
          ok: false,
          status: 400,
          message: `Pesanan paket "${pkg.name}" (${item.quantityOrdered}) melebihi total siswa aktif kelas ${pkg.gradeLevel} di cabang ini (${studentCount} siswa)`,
        };
      }
    }
  }

  const now = (deps.now ?? (() => new Date().toISOString()))();
  const id = (deps.generateId ?? (() => crypto.randomUUID()))();
  const poNumber =
    deps.generatePoNumber?.(now) ??
    documentNumber("IPO", epochTimeFragment(Date.now(), 6), randomSerial(6));
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
        destinationSchoolId: po.schoolId,
        deliveryNoteNumber: input.deliveryNoteNumber.trim(),
        transferShipmentId: input.transferShipmentId || null,
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
