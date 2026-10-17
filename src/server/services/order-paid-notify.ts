import type { AppDatabase } from "../../db";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { EmailSendOptions, EmailSendResult } from "./email/types";
import { sendEmailNotification } from "./email/factory";
import { MetaWhatsAppSender, type WhatsAppSender } from "./whatsapp";

/**
 * Notifikasi hasil verifikasi bukti transfer ke orang tua: WhatsApp (Meta
 * official) + email. SELALU best-effort — kegagalan kanal TIDAK pernah
 * membatalkan keputusan verifikasi/tolak yang sudah tersimpan (§10: tulis
 * pembayaran tidak boleh di-rollback oleh notifikasi). Kedua kanal
 * fail-safe: tanpa kredensial, pengiriman disimulasikan dan tetap "sukses".
 */

export type NotifyKind = "buku" | "seragam";

const KIND_LABEL: Record<NotifyKind, string> = { buku: "buku", seragam: "seragam" };

export interface PaidOffNoticeInput {
  studentName: string;
  orderNumber: string;
  kind: NotifyKind;
  amount: number;
}

/** Teks bukti terverifikasi + pesanan lunas. Murni: tanpa DB, tanpa IO. */
export const buildPaidOffNotice = ({ studentName, orderNumber, kind, amount }: PaidOffNoticeInput): string =>
  `Halo Bapak/Ibu, bukti pembayaran ${KIND_LABEL[kind]} untuk ananda ${studentName} (${orderNumber}) telah diverifikasi gudang.\n` +
  `Nominal terverifikasi: ${formatRupiah(amount)}\n` +
  `Status tagihan: LUNAS.\n\nTerima kasih, Al Wildan Logistics`;

export interface RejectedNoticeInput {
  studentName: string;
  orderNumber: string;
  kind: NotifyKind;
  reason: string;
  confirmUrl: string;
}

/** Teks penolakan + alasan + tautan unggah ulang. Murni: tanpa DB, tanpa IO. */
export const buildRejectedNotice = ({ studentName, orderNumber, kind, reason, confirmUrl }: RejectedNoticeInput): string =>
  `Halo Bapak/Ibu, mohon maaf bukti pembayaran ${KIND_LABEL[kind]} untuk ananda ${studentName} (${orderNumber}) belum dapat kami verifikasi.\n` +
  `Alasan: ${reason}\n\n` +
  `Silakan unggah ulang bukti transfer yang benar melalui tautan berikut:\n${confirmUrl}\n\nTerima kasih, Al Wildan Logistics`;

export interface NotifyStudent {
  name: string;
  parentPhone?: string | null;
  parentEmail?: string | null;
}

export interface NotifyOrderRef {
  orderNumber: string;
}

export interface NotifyDeps {
  wa?: WhatsAppSender;
  mail?: (options: EmailSendOptions) => Promise<EmailSendResult>;
}

export interface ChannelResult {
  success: boolean;
  simulated?: boolean;
  error?: string;
}

export interface NotifyResult {
  wa: ChannelResult;
  email: ChannelResult;
}

const attempt = async (run: () => Promise<ChannelResult>): Promise<ChannelResult> => {
  try {
    return await run();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Notifikasi gagal dikirim." };
  }
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const dispatch = async (
  database: AppDatabase,
  deps: NotifyDeps | undefined,
  student: NotifyStudent,
  text: string,
  subject: string
): Promise<NotifyResult> => {
  const phone = student.parentPhone;
  const email = student.parentEmail;
  const wa = phone
    ? await attempt(() => (deps?.wa ?? new MetaWhatsAppSender(database)).send({ to: phone, text }))
    : { success: false, error: "Nomor WA orang tua tidak tersedia." };
  const mailer = deps?.mail ?? ((options: EmailSendOptions) => sendEmailNotification(database, options));
  const mail = email
    ? await attempt(() =>
        mailer({ to: email, subject, text, html: `<p>${escapeHtml(text).replace(/\n/g, "<br/>")}</p>` })
      )
    : { success: false, error: "Email orang tua tidak tersedia." };
  return { wa, email: mail };
};

/** Notifikasi "lunas terverifikasi" ke orang tua (WA + email, fail-safe). */
export const notifyOrderPaidOff = (
  database: AppDatabase,
  input: { order: NotifyOrderRef; student: NotifyStudent; amount: number; kind: NotifyKind },
  deps?: NotifyDeps
): Promise<NotifyResult> =>
  dispatch(
    database,
    deps,
    input.student,
    buildPaidOffNotice({
      studentName: input.student.name,
      orderNumber: input.order.orderNumber,
      kind: input.kind,
      amount: input.amount,
    }),
    `Pembayaran ${KIND_LABEL[input.kind]} ${input.order.orderNumber} terverifikasi`
  );

/** Notifikasi "bukti ditolak" + alasan + tautan unggah ulang (WA + email). */
export const notifyPaymentRejected = (
  database: AppDatabase,
  input: { order: NotifyOrderRef; student: NotifyStudent; reason: string; confirmUrl: string; kind: NotifyKind },
  deps?: NotifyDeps
): Promise<NotifyResult> =>
  dispatch(
    database,
    deps,
    input.student,
    buildRejectedNotice({
      studentName: input.student.name,
      orderNumber: input.order.orderNumber,
      kind: input.kind,
      reason: input.reason,
      confirmUrl: input.confirmUrl,
    }),
    `Bukti pembayaran ${KIND_LABEL[input.kind]} ${input.order.orderNumber} perlu diunggah ulang`
  );
