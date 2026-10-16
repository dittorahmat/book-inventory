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

type InvoiceGate = (
  database: AppDatabase,
  actor: AccessActor,
  orderId: string
) => Promise<null | { status: 403; message: string }>;

/** Kapabilitas per kind: tambah kind baru = tambah satu baris, bukan cabang baru. */
const ADAPTERS = {
  buku: {
    sendInvoice: sendBookInvoice,
    setShipping: setBookShipping,
    confirmPayment: confirmBookPayment,
    lookupByToken: lookupBookByToken,
    assertInvoiceGate: assertSendInvoiceAllowed as InvoiceGate,
  },
  seragam: {
    sendInvoice: sendUniformInvoice,
    setShipping: setUniformShipping,
    confirmPayment: confirmUniformPayment,
    lookupByToken: lookupUniformByToken,
    assertInvoiceGate: ((_database, _actor, _orderId) => Promise.resolve(null)) as InvoiceGate,
  },
} satisfies Record<
  BillingKind,
  {
    sendInvoice: (database: AppDatabase, orderId: string, opts: SendInvoiceDeps) => unknown;
    setShipping: (
      database: AppDatabase,
      orderId: string,
      input: { shippingCost: number; shippingResi?: string },
      deps?: WriteDeps
    ) => unknown;
    confirmPayment: (
      database: AppDatabase,
      token: string,
      input: ConfirmPaymentInput,
      deps?: ConfirmDeps
    ) => unknown;
    lookupByToken: (database: AppDatabase, token: string) => unknown;
    assertInvoiceGate: InvoiceGate;
  }
>;

export const sendInvoice = (
  database: AppDatabase,
  orderId: string,
  opts: BillingInvoiceOpts
): Promise<
  | { ok: true; data: { order: { id: string }; confirmUrl: string; notification: unknown } }
  | { ok: false; status: 400 | 404; message: string }
> =>
  ADAPTERS[opts.kind].sendInvoice(database, orderId, opts) as Promise<
    | { ok: true; data: { order: { id: string }; confirmUrl: string; notification: unknown } }
    | { ok: false; status: 400 | 404; message: string }
  >;

export const setShipping = (
  database: AppDatabase,
  orderId: string,
  input: { shippingCost: number; shippingResi?: string },
  kind: BillingKind,
  deps?: WriteDeps
) => ADAPTERS[kind].setShipping(database, orderId, input, deps);

export const confirmPayment = (
  database: AppDatabase,
  token: string,
  input: ConfirmPaymentInput,
  kind: BillingKind,
  deps?: ConfirmDeps
) => ADAPTERS[kind].confirmPayment(database, token, input, deps);

export const lookupByToken = (database: AppDatabase, token: string, kind: BillingKind) =>
  ADAPTERS[kind].lookupByToken(database, token);

/** Gerbang kirim invoice: buku memakai gate satuan-vs-paket, seragam tanpa gate tambahan (gate ongkir di dalam pengirim). */
export const assertInvoiceGate = (
  database: AppDatabase,
  actor: AccessActor,
  orderId: string,
  kind: BillingKind
): Promise<null | { status: 403; message: string }> => ADAPTERS[kind].assertInvoiceGate(database, actor, orderId);
