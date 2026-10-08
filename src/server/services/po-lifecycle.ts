import { eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDatabase } from "../../db";
import { purchaseOrders } from "../../db/schema";
import { defaultStorage } from "../../services/storage";
import {
  LEGACY_PO_STATUSES,
  PRINTED_STATUS,
  SIGNED_UPLOADED_STATUS,
  evaluateSendGate,
  validateSignedDoc,
} from "./po-workflow";
import { sendPurchaseOrderEmail } from "./po-delivery";
import type { EmailRuntimeEnv } from "./email/types";

export { LEGACY_PO_STATUSES, PRINTED_STATUS, SIGNED_UPLOADED_STATUS, evaluateSendGate, validateSignedDoc };

export type LifecycleError = { ok: false; status: ContentfulStatusCode; message: string };

type LifecycleFile = Pick<File, "name" | "type" | "size" | "arrayBuffer">;

/**
 * Satu-satunya pemilik siklus hidup PO cetak → tanda tangan → kirim.
 * Route hanya validasi + scope; transisi, gerbang kirim, dan jejak
 * pengiriman tinggal di sini. Pengiriman email didelegasikan ke
 * adapter po-delivery (satu seam, dua adapter: terkirim vs simulasi).
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
  file: LifecycleFile | undefined
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
  const signedDocUrl = await defaultStorage.upload(key, await file.arrayBuffer(), validation.contentType);

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
  env?: EmailRuntimeEnv
): Promise<SendPoResult> {
  const [po] = await database.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
  if (!po) return { ok: false, status: 404, message: "Purchase Order tidak ditemukan" };

  const gate = evaluateSendGate(po);
  if (!gate.allowed) {
    return { ok: false, status: 400, message: gate.message };
  }

  const outcome = await sendPurchaseOrderEmail(poId, env);
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
