import type { AppDatabase } from "../../db";
import type { AccessActor } from "./access-scope";
import {
  confirmBookPayment,
  confirmUniformPayment,
  lookupBookByToken,
  lookupUniformByToken,
  sendBookInvoice,
  sendUniformInvoice,
  type ConfirmDeps,
  type ConfirmPaymentInput,
  type SendInvoiceDeps,
} from "./order-invoice";
import { assertSendInvoiceAllowed, setBookShipping, setUniformShipping } from "./order-shipping";
import type { WriteDeps } from "../lib/d1-write";

/**
 * Satu-satunya pemilik tagihan Invoice WhatsApp + ongkir Kirim-Rumah
 * untuk dua kind (buku|seragam): route hanya meneruskan kind, seluruh
 * perbedaan tabel + gerbang tinggal di balik satu seam ini.
 * Perbedaan yang dipertahankan: pesan 404 per-kind tetap beda, dan
 * gerbang ongkir buku hanya untuk order satuan (ada baris
 * studentOrderItems) sedangkan seragam selalu digerbangi — sesuai
 * audit kesetaraan; bukan penyatuan diam-diam.
 */
export type BillingKind = "buku" | "seragam";

export interface BillingInvoiceOpts extends SendInvoiceDeps {
  kind: BillingKind;
}

export const sendInvoice = (
  database: AppDatabase,
  orderId: string,
  opts: BillingInvoiceOpts
): Promise<
  | { ok: true; data: { order: { id: string }; confirmUrl: string; notification: unknown } }
  | { ok: false; status: 400 | 404; message: string }
> =>
  opts.kind === "buku"
    ? sendBookInvoice(database, orderId, opts)
    : sendUniformInvoice(database, orderId, opts);

export const setShipping = (
  database: AppDatabase,
  orderId: string,
  input: { shippingCost: number; shippingResi?: string },
  kind: BillingKind,
  deps?: WriteDeps
) => (kind === "buku" ? setBookShipping(database, orderId, input, deps) : setUniformShipping(database, orderId, input, deps));

export const confirmPayment = (
  database: AppDatabase,
  token: string,
  input: ConfirmPaymentInput,
  kind: BillingKind,
  deps?: ConfirmDeps
) => (kind === "buku" ? confirmBookPayment(database, token, input, deps) : confirmUniformPayment(database, token, input, deps));

export const lookupByToken = (database: AppDatabase, token: string, kind: BillingKind) =>
  kind === "buku" ? lookupBookByToken(database, token) : lookupUniformByToken(database, token);

/** Gerbang kirim invoice: buku memakai gate satuan-vs-paket, seragam tanpa gate tambahan (gate ongkir di dalam pengirim). */
export const assertInvoiceGate = (
  database: AppDatabase,
  actor: AccessActor,
  orderId: string,
  kind: BillingKind
): Promise<null | { status: 403; message: string }> =>
  kind === "buku" ? assertSendInvoiceAllowed(database, actor, orderId) : Promise.resolve(null);
