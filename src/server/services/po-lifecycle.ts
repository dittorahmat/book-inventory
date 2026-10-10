import { eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { purchaseOrderItems, purchaseOrders } from "../../db/schema";
import { defaultStorage, type StorageService } from "../../services/storage";
import {
  LEGACY_PO_STATUSES,
  PRINTED_STATUS,
  SIGNED_UPLOADED_STATUS,
  evaluateSendGate,
  validateSignedDoc,
} from "./po-workflow";
import { deliverPurchaseOrder } from "./po-delivery";
import type { PoMailSender } from "./po-mail";
import type { EmailRuntimeEnv } from "./email/types";

export {
  LEGACY_PO_STATUSES,
  PRINTED_STATUS,
  SIGNED_UPLOADED_STATUS,
  evaluateSendGate,
  validateSignedDoc,
};
/** Satu seam publik: pemanggil (route) melintasi modul ini, bukan po-workflow/po-delivery langsung. */
export {
  createPurchaseOrder,
  resolveWarehouseId,
  resolveWarehouseTarget,
} from "./po-workflow";
export { receivePurchaseOrder } from "./po-receipt";
export type {
  CreatePoDeps,
  CreatePoInput,
  CreatePoItemInput,
  CreatePoResult,
  CreatedPo,
  CreatedPoItem,
  ReceivedItemInput,
  ReceivePoResult,
  SendGate,
  SignedDocValidation,
  WarehouseTargetResult,
} from "./po-workflow";
export { deliverPurchaseOrder } from "./po-delivery";
export type { PoDeliveryDeps, PoSendOutcome } from "./po-delivery";
export { recordPoReceipt, getPoReceiptHistory } from "./po-receipt";
export type { CreatePoReceiptInput } from "./po-receipt";
export { InMemoryPoMailSender, RealPoMailSender } from "./po-mail";
export type { PoMailRequest, PoMailSender } from "./po-mail";

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
  poId: string
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

  const now = new Date().toISOString();
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
  storage?: StorageService
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
  const key = `po-signed/${po.id}-${Date.now()}.${extension}`;
  const store: StorageService = storage ?? defaultStorage;
  const signedDocUrl = await store.upload(key, await file.arrayBuffer(), validation.contentType);

  const now = new Date().toISOString();
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

  await database.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
  await database.delete(purchaseOrders).where(eq(purchaseOrders.id, poId));
  return { ok: true, data: { id: po.id, poNumber: po.poNumber } };
}
