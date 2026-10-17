import { describe, expect, test } from "bun:test";
import {
  derivePaymentStatus,
  grossOrderAmount,
  validateSatuanCutoff,
  validateStudentForOrder,
} from "./validation";

describe("order-validation murni", () => {
  test("siswa hilang → 404; pending → 403; aktif/promosi lolos", () => {
    expect(validateStudentForOrder(undefined)).toMatchObject({ ok: false, status: 404 });
    expect(validateStudentForOrder({ status: "new_pending" })).toMatchObject({ ok: false, status: 403 });
    expect(validateStudentForOrder({ status: "active" })).toMatchObject({ ok: true });
    expect(validateStudentForOrder({ status: "promoted" })).toMatchObject({ ok: true });
  });

  test("cutoff satuan tertutup menolak item satuan, paket tetap lolos", () => {
    const closed = { open: false, reason: "Tutup tahun ajaran." };
    expect(validateSatuanCutoff(true, closed)).toMatchObject({ ok: false, status: 403 });
    expect(validateSatuanCutoff(false, closed)).toEqual({ ok: true });
    expect(validateSatuanCutoff(true, { open: true, reason: "" })).toEqual({ ok: true });
  });

  test("derivasi pembayaran: beasiswa & reguler selalu belum terbayar (uang sah hanya setelah verifikasi)", () => {
    expect(derivePaymentStatus({ isScholarship: true, grossAmount: 900000 }))
      .toEqual({ totalAmount: 0, paidAmount: 0, paymentStatus: "scholarship_pending" });
    expect(derivePaymentStatus({ isScholarship: false, grossAmount: 900000 }))
      .toEqual({ totalAmount: 900000, paidAmount: 0, paymentStatus: "unpaid" });
  });

  test("kotor = paket + snapshot satuan", () => {
    expect(grossOrderAmount(800000, [{ unitPrice: 50000, quantity: 2 }])).toBe(900000);
    expect(grossOrderAmount(0, [])).toBe(0);
  });
});
