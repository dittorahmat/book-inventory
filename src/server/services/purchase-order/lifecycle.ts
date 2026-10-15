import { desc, eq, inArray } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../../db";
import { books, purchaseOrderItems, purchaseOrders, schools, suppliers } from "../../../db/schema";
import { defaultStorage, type StorageService } from "../../../services/storage";
import {
  PRINTED_STATUS,
  SIGNED_UPLOADED_STATUS,
  evaluateSendGate,
  validateSignedDoc,
} from "./workflow";
import { deliverPurchaseOrder } from "./delivery";
import type { PoMailSender } from "./delivery";
import type { EmailRuntimeEnv } from "../email/types";
import { writeNow, runWriteBatch, type WriteDeps } from "../../lib/d1-write";

export type LifecycleDeps = WriteDeps;

export type LifecycleError = { ok: false; status: ContentfulStatusCode; message: string };

type LifecycleFile = Pick<File, "name" | "type" | "size" | "arrayBuffer">;

/**
 * Satu-satunya pemilik siklus hidup PO cetak → tanda tangan → kirim.
 * Route hanya validasi + scope; gate, transisi, dan delivery tinggal di sini.
 * Storage dan mail diterima sebagai seam (default produksi), sehingga test
 * memakai adapter in-memory tanpa mock env/storage global.
 */
export async function markPrinted(
  database: AppDatabase,
  poId: string,
  deps?: LifecycleDeps
): Promise<{ ok: true; data: { id: string; status: string; printedAt: string; poNumber: string } } | LifecycleError> {
  const [po] = await database.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) return { ok: false, status: 404, message: "Purchase Order tidak ditemukan" };

  if (po.status === PRINTED_STATUS) {
    return { ok: true, data: { id: po.id, status: po.status, printedAt: po.printedAt ?? "", poNumber: po.poNumber } };
  }
  if (po.status !== "draft") {
    return {
      ok: false,
      status: 400,
      message: `Hanya PO berstatus draft yang dapat ditandai dicetak (PO ${po.poNumber} saat ini ${po.status})`,
    };
  }

  const now = writeNow(deps);
  await database
    .update(purchaseOrders)
    .set({ status: PRINTED_STATUS, printedAt: now, updatedAt: now })
    .where(eq(purchaseOrders.id, po.id));

  return { ok: true, data: { id: po.id, status: PRINTED_STATUS, printedAt: now, poNumber: po.poNumber } };
}

export async function uploadSignedDoc(
  database: AppDatabase,
  poId: string,
  file: LifecycleFile | undefined,
  storage?: StorageService,
  deps?: LifecycleDeps
): Promise<
  | { ok: true; data: { id: string; status: string; signedDocUrl: string; signedDocName: string; poNumber: string } }
  | LifecycleError
> {
  const [po] = await database.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) return { ok: false, status: 404, message: "Purchase Order tidak ditemukan" };

  const canUpload = po.status === PRINTED_STATUS || po.status === SIGNED_UPLOADED_STATUS;
  if (!canUpload) {
    return {
      ok: false,
      status: 400,
      message: `Berkas bukti hanya dapat diupload pada PO berstatus dicetak atau sudah upload bukti (PO ${po.poNumber} saat ini ${po.status})`,
    };
  }
  if (!file) return { ok: false, status: 400, message: "Berkas bukti tanda tangan wajib diupload" };

  const validation = validateSignedDoc(file as File);
  if (!validation.ok) return { ok: false, status: 400, message: validation.message };

  const extension = (file.name.split(".").pop() || "pdf").toLowerCase();
  const now = writeNow(deps);
  const key = `po-signed/${po.id}-${now.replace(/\D/g, "")}.${extension}`;
  const store: StorageService = storage ?? defaultStorage;
  const signedDocUrl = await store.upload(key, await file.arrayBuffer(), validation.contentType);

  await database
    .update(purchaseOrders)
    .set({
      status: SIGNED_UPLOADED_STATUS,
      signedDocUrl,
      signedDocName: file.name,
      signedDocType: validation.contentType,
      signedDocUploadedAt: now,
      updatedAt: now,
    })
    .where(eq(purchaseOrders.id, po.id));

  return {
    ok: true,
    data: { id: po.id, status: SIGNED_UPLOADED_STATUS, signedDocUrl, signedDocName: file.name, poNumber: po.poNumber },
  };
}

export type SendPoResult =
  | { ok: true; simulated: boolean; message: string; data: unknown }
  | LifecycleError;

/** Gerbang kirim + pengiriman dalam satu seam: route tidak lagi memanggil gate manual. */
export async function sendPo(
  database: AppDatabase,
  poId: string,
  env?: EmailRuntimeEnv,
  deps?: { mail?: PoMailSender }
): Promise<SendPoResult> {
  const [po] = await database.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) return { ok: false, status: 404, message: "Purchase Order tidak ditemukan" };

  const gate = evaluateSendGate(po);
  if (!gate.allowed) {
    return { ok: false, status: 400, message: gate.message };
  }

  const outcome = await deliverPurchaseOrder(database, poId, { mail: deps?.mail, env });
  if (outcome.kind === "error") {
    return { ok: false, status: outcome.httpStatus, message: outcome.message };
  }
  if (outcome.kind === "simulated") {
    return {
      ok: true,
      simulated: true,
      message: `PO ${outcome.poNumber} hanya disimulasikan ke ${outcome.sentTo} dan TIDAK benar-benar terkirim. ${outcome.detail}`,
      data: outcome,
    };
  }
  return {
    ok: true,
    simulated: false,
    message: `PO ${outcome.poNumber} terkirim via ${outcome.provider} ke ${outcome.sentTo}`,
    data: outcome,
  };
}

export interface PoSendReadiness {
  canSend: boolean;
  sendBlockedReason: string | null;
}
/**
 * Derivasi kelayakan kirim sekali untuk seluruh baris list: route memanggil
 * satu kali ini, bukan `evaluateSendGate` per baris.
 */
export const withSendReadiness = <
  T extends Pick<typeof purchaseOrders.$inferSelect, "status" | "signedDocUrl" | "poNumber">,
>(
  rows: T[]
): Array<T & PoSendReadiness> =>
  rows.map((row): T & PoSendReadiness => {
    const gate = evaluateSendGate(row);
    return gate.allowed
      ? { ...row, canSend: true, sendBlockedReason: null }
      : { ...row, canSend: false, sendBlockedReason: gate.message };
  });

export type DeletePoResult =
  | { ok: true; data: { id: string; poNumber: string } }
  | LifecycleError;
/**
 * Satu-satunya pemilik guard hapus Supplier PO: hanya PO yang belum pernah
 * menerima barang. Route tidak lagi menghitung quantityReceived sendiri.
 */
export async function deletePurchaseOrder(
  database: AppDatabase,
  poId: string
): Promise<DeletePoResult> {
  const [po] = await database.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) return { ok: false, status: 404, message: "Purchase Order tidak ditemukan" };

  const items = await database
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId));
  const totalReceived = items.reduce(
    (sum: number, it: { quantityReceived: number }) => sum + (it.quantityReceived || 0),
    0
  );
  const totalOrdered = items.reduce(
    (sum: number, it: { quantityOrdered: number }) => sum + (it.quantityOrdered || 0),
    0
  );

  if (totalReceived > 0 || po.status === "received" || po.status === "partially_received") {
    return {
      ok: false,
      status: 400,
      message: `Purchase Order "${po.poNumber}" tidak dapat dihapus karena barang sudah diterima ke gudang (${totalReceived}/${totalOrdered} eks). Stok fisik buku telah terbit ke inventaris.`,
    };
  }

  await runWriteBatch(database, [
    database.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId)),
    database.delete(purchaseOrders).where(eq(purchaseOrders.id, poId)),
  ]);
  return { ok: true, data: { id: po.id, poNumber: po.poNumber } };
}

export interface PoListRow {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string | null;
  targetSchoolId: string;
  schoolName: string;
  status: typeof purchaseOrders.$inferSelect["status"];
  orderDate: string;
  expectedArrivalDate: string | null;
  subtotalGross: number;
  discountTotal: number;
  totalAmount: number;
  notes: string | null;
  printedAt: string | null;
  signedDocUrl: string | null;
  signedDocName: string | null;
  signedDocType: string | null;
  signedDocUploadedAt: string | null;
  sentAt: string | null;
  sentTo: string | null;
  createdAt: string;
  items: PoListItem[];
  canSend: boolean;
  sendBlockedReason: string | null;
}

export interface PoListItem {
  purchaseOrderId: string;
  id: string;
  bookId: string;
  title: string;
  isbn: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  discountPercent: number;
}

/**
 * Satu-satunya pemilik bacaan daftar Supplier PO beserta baris bukunya:
 * filter scope di WHERE SQL + LIMIT di server, kelayakan kirim diturunkan
 * sekali di sini via withSendReadiness — bukan per baris di route, bukan
 * saring JS pasca-fetch (§11 anti Pindai Penuh).
 */
export const listPOsWithItems = async (
  database: AppDatabase,
  scope: string[],
  limit = 100
): Promise<PoListRow[]> => {
  const scoped = scope.length > 0 ? scope : ["__no_school__"];
  const pos: Array<Omit<PoListRow, "items" | "canSend" | "sendBlockedReason">> = await database
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      supplierEmail: suppliers.email,
      targetSchoolId: purchaseOrders.targetSchoolId,
      schoolName: schools.name,
      status: purchaseOrders.status,
      orderDate: purchaseOrders.orderDate,
      expectedArrivalDate: purchaseOrders.expectedArrivalDate,
      subtotalGross: purchaseOrders.subtotalGross,
      discountTotal: purchaseOrders.discountTotal,
      totalAmount: purchaseOrders.totalAmount,
      notes: purchaseOrders.notes,
      printedAt: purchaseOrders.printedAt,
      signedDocUrl: purchaseOrders.signedDocUrl,
      signedDocName: purchaseOrders.signedDocName,
      signedDocType: purchaseOrders.signedDocType,
      signedDocUploadedAt: purchaseOrders.signedDocUploadedAt,
      sentAt: purchaseOrders.sentAt,
      sentTo: purchaseOrders.sentTo,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .innerJoin(schools, eq(purchaseOrders.targetSchoolId, schools.id))
    .where(inArray(purchaseOrders.targetSchoolId, scoped))
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(limit);

  const poIds = pos.map((po) => po.id);
  const allItems: PoListItem[] =
    poIds.length > 0
      ? await database
          .select({
            purchaseOrderId: purchaseOrderItems.purchaseOrderId,
            id: purchaseOrderItems.id,
            bookId: purchaseOrderItems.bookId,
            title: books.title,
            isbn: books.isbn,
            quantityOrdered: purchaseOrderItems.quantityOrdered,
            quantityReceived: purchaseOrderItems.quantityReceived,
            unitPrice: purchaseOrderItems.unitPrice,
            discountPercent: purchaseOrderItems.discountPercent,
          })
          .from(purchaseOrderItems)
          .innerJoin(books, eq(purchaseOrderItems.bookId, books.id))
          .where(inArray(purchaseOrderItems.purchaseOrderId, poIds))
      : [];
  const itemsByPo = new Map<string, typeof allItems>();
  for (const it of allItems) {
    const list = itemsByPo.get(it.purchaseOrderId) ?? [];
    list.push(it);
    itemsByPo.set(it.purchaseOrderId, list);
  }
  return withSendReadiness(pos.map((po: (typeof pos)[number]) => ({ ...po, items: itemsByPo.get(po.id) ?? [] })));
};
