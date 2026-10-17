import { describe, expect, it } from "bun:test";
import type { EmailSendOptions, EmailSendResult } from "./email/types";
import {
  buildPaidOffNotice,
  buildRejectedNotice,
  notifyOrderPaidOff,
  notifyPaymentRejected,
} from "./order-paid-notify";
import type { SendWhatsAppResult, WhatsAppRequest, WhatsAppSender } from "./whatsapp";

// Kedua kanal selalu diinjeksi di test ini, jadi `database` sengaja dummy
// (objek kosong) — sekali pun tersentuh, test akan gagal bunyi, bukan diam.
const fakeDb = {};

const recordingMail = (
  captured: EmailSendOptions[],
  result: EmailSendResult = { success: true, provider: "simulated", simulated: true }
) => async (options: EmailSendOptions): Promise<EmailSendResult> => {
  captured.push(options);
  return result;
};

const recordingWa = (
  captured: WhatsAppRequest[],
  result: SendWhatsAppResult = { success: true }
): WhatsAppSender => ({
  name: "test",
  send: async (request) => {
    captured.push(request);
    return result;
  },
});

const student = { name: "Budi Santoso", parentPhone: "+628120000000", parentEmail: "ortu@contoh.id" };

describe("buildPaidOffNotice / buildRejectedNotice (murni)", () => {
  it("menyusun teks lunas dengan nominal rupiah", () => {
    const text = buildPaidOffNotice({ studentName: "Budi Santoso", orderNumber: "ORD-1", kind: "buku", amount: 150000 });
    expect(text).toContain("Budi Santoso (ORD-1)");
    expect(text).toContain("Rp 150.000");
    expect(text).toContain("LUNAS");
  });

  it("menyusun teks penolakan dengan alasan dan tautan unggah ulang", () => {
    const text = buildRejectedNotice({
      studentName: "Budi Santoso",
      orderNumber: "ORD-2",
      kind: "seragam",
      reason: "Nominal tidak sesuai",
      confirmUrl: "https://contoh.id/konfirmasi?t=abc",
    });
    expect(text).toContain("Alasan: Nominal tidak sesuai");
    expect(text).toContain("https://contoh.id/konfirmasi?t=abc");
  });
});

describe("notifyOrderPaidOff (WA + email, fail-safe)", () => {
  it("meng-escape HTML email dengan sidik kanonik tapi mengirim teks mentah ke WhatsApp", async () => {
    const mail: EmailSendOptions[] = [];
    const wa: WhatsAppRequest[] = [];
    const hostile = `O'Brien & <Co> "kutipan"`;

    const result = await notifyOrderPaidOff(
      fakeDb,
      {
        order: { orderNumber: `ORD-<1>&` },
        student: { ...student, name: hostile },
        amount: 150000,
        kind: "buku",
      },
      { mail: recordingMail(mail), wa: recordingWa(wa) }
    );

    expect(result.wa.success).toBe(true);
    expect(result.email.success).toBe(true);
    expect(result.email.simulated).toBe(true);
    // Email: 5 karakter berbahaya di-escape oleh `escapeHtml` kanonik (po-template).
    expect(mail[0]?.html).toContain("&amp;");
    expect(mail[0]?.html).toContain("&lt;");
    expect(mail[0]?.html).toContain("&gt;");
    expect(mail[0]?.html).toContain("&quot;");
    expect(mail[0]?.html).toContain("&#39;");
    expect(mail[0]?.html).not.toContain("<Co>");
    expect(mail[0]?.html).toContain("<br/>");
    // WhatsApp: teks mentah, tanpa entitas HTML.
    expect(wa[0]?.text).toContain(hostile);
    expect(wa[0]?.text).not.toContain("&amp;");
  });

  it("kanal WhatsApp gagal tidak membatalkan email (best-effort)", async () => {
    const mail: EmailSendOptions[] = [];
    const brokenWa: WhatsAppSender = {
      name: "broken",
      send: async () => {
        throw new Error("Meta menolak permintaan.");
      },
    };

    const result = await notifyOrderPaidOff(
      fakeDb,
      { order: { orderNumber: "ORD-3" }, student, amount: 100000, kind: "buku" },
      { mail: recordingMail(mail), wa: brokenWa }
    );

    expect(result.wa).toEqual({ success: false, error: "Meta menolak permintaan." });
    expect(result.email.success).toBe(true);
    expect(mail).toHaveLength(1);
  });

  it("kanal email gagal tidak membatalkan WhatsApp (best-effort)", async () => {
    const wa: WhatsAppRequest[] = [];
    const brokenMail = async (): Promise<EmailSendResult> => {
      throw new Error("Brevo mati.");
    };

    const result = await notifyPaymentRejected(
      fakeDb,
      {
        order: { orderNumber: "ORD-4" },
        student,
        reason: "Bukti tidak terbaca",
        confirmUrl: "https://contoh.id/konfirmasi?t=xyz",
        kind: "seragam",
      },
      { mail: brokenMail, wa: recordingWa(wa) }
    );

    expect(result.email).toEqual({ success: false, error: "Brevo mati." });
    expect(result.wa.success).toBe(true);
    expect(wa[0]?.text).toContain("Bukti tidak terbaca");
  });

  it("tanpa nomor WA dan tanpa email tetap melaporkan kedua kanal gagal dengan alasan jelas", async () => {
    const result = await notifyOrderPaidOff(
      fakeDb,
      {
        order: { orderNumber: "ORD-5" },
        student: { name: "Tanpa Kontak", parentPhone: null, parentEmail: null },
        amount: 50000,
        kind: "buku",
      },
      { mail: recordingMail([]), wa: recordingWa([]) }
    );

    expect(result.wa).toEqual({ success: false, error: "Nomor WA orang tua tidak tersedia." });
    expect(result.email).toEqual({ success: false, error: "Email orang tua tidak tersedia." });
  });
});
