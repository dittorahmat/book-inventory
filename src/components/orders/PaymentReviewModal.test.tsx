import "../portal/test-dom";
import { afterEach, describe, expect, it } from "bun:test";
// Dinamis + top-level await: shim DOM harus terpasang sebelum modul CJS
// @testing-library mengikat screen ke document.body.
const { cleanup, render, screen, fireEvent } = await import("@testing-library/react");
import { PaymentReviewModal } from "./PaymentReviewModal";
import type {
  PaymentReviewResult,
  PaymentReviewRow,
  PaymentReviewSnapshot,
} from "../../lib/payment-review-types";

afterEach(() => {
  cleanup();
});

const row = (overrides: Partial<PaymentReviewRow>): PaymentReviewRow => ({
  id: "pay-t6-1",
  transferAmount: 500_000,
  allocationAmount: 300_000,
  paymentProofUrl: "https://example.test/bukti.png",
  bankName: "BCA",
  referenceNumber: "REF-T6",
  verifiedAt: null,
  rejectedAt: null,
  rejectReason: null,
  notes: null,
  createdAt: "2026-10-10T08:00:00.000Z",
  status: "pending",
  ...overrides,
});

const snapshot = (payments: PaymentReviewRow[]): PaymentReviewSnapshot => ({
  payments,
  pendingCount: payments.filter((p) => p.status === "pending").length,
  remainingAmount: 200_000,
});

interface RenderOptions {
  load?: () => Promise<PaymentReviewSnapshot>;
  verify?: (paymentId: string) => Promise<PaymentReviewResult>;
  reject?: (paymentId: string, reason: string) => Promise<PaymentReviewResult>;
}

const renderModal = (options: RenderOptions = {}) =>
  render(
    <PaymentReviewModal
      heading="Order ORD-T6-1"
      subheading="Anak T6 · Paket T6"
      load={options.load ?? (async () => snapshot([row({})]))}
      verify={options.verify ?? (async () => ({}))}
      reject={options.reject ?? (async () => ({}))}
      onClose={() => {}}
    />
  );

describe("PaymentReviewModal (T6: review bukti pembayaran ortu)", () => {
  it("menampilkan baris pending terbaru lebih dulu dengan nominal, alokasi dan bank", async () => {
    renderModal({
      load: async () =>
        snapshot([
          row({ id: "pay-lama", createdAt: "2026-10-01T02:00:00.000Z", bankName: "Mandiri" }),
          row({ id: "pay-baru", createdAt: "2026-10-12T02:00:00.000Z", bankName: "BNI" }),
        ]),
    });

    expect(await screen.findAllByText("MENUNGGU")).toHaveLength(2);
    const banks = screen.getAllByText(/Bank: (BNI|Mandiri)/);
    expect(banks).toHaveLength(2);
    expect(banks[0].textContent).toContain("BNI");
    expect(screen.getAllByText(/Rp 500\.000/)).toHaveLength(2);
    expect(screen.getByText("Bukti menunggu:")).toBeDefined();
  });

  it("menonaktifkan tombol Kirim Penolakan sampai alasan diisi", async () => {
    const captured: { reason: string | null } = { reason: null };
    renderModal({
      reject: async (_paymentId, reason) => {
        captured.reason = reason;
        return {};
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Tolak" }));
    const submit = screen.getByRole("button", { name: "Kirim Penolakan" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Alasan penolakan/), {
      target: { value: "Nominal tidak sesuai tagihan" },
    });
    expect(submit.disabled).toBe(false);

    fireEvent.click(submit);
    await screen.findByRole("status");
    expect(captured.reason).toBe("Nominal tidak sesuai tagihan");
    expect(screen.getByRole("status").textContent).toContain("Pembayaran ditolak.");
  });

  it("menampilkan toast eksplisit dari data.notification saat verifikasi berhasil", async () => {
    renderModal({
      verify: async () => ({
        notification: { wa: { success: true }, email: { success: false, error: "SMTP down" } },
      }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Verifikasi" }));
    const toast = await screen.findByRole("status");
    expect(toast.textContent).toContain("Pembayaran terverifikasi.");
    expect(toast.textContent).toContain("WA: terkirim");
    expect(toast.textContent).toContain("Email gagal: SMTP down");
  });

  it("menampilkan pesan server apa adanya saat verifikasi gagal", async () => {
    renderModal({
      verify: async () => {
        throw new Error("Pembayaran sudah ditolak sebelumnya.");
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Verifikasi" }));
    const alertBox = await screen.findByRole("alert");
    expect(alertBox.textContent).toContain("Pembayaran sudah ditolak sebelumnya.");
  });

  it("menampilkan error muat yang eksplisit, bukan layar kosong", async () => {
    renderModal({
      load: async () => {
        throw new Error("Order tidak ditemukan.");
      },
    });

    const alertBox = await screen.findByRole("alert");
    expect(alertBox.textContent).toContain("Order tidak ditemukan.");
  });

  it("menampilkan empty state saat belum ada bukti dan alasan penolakan pada baris ditolak", async () => {
    renderModal({ load: async () => snapshot([]) });
    expect(
      await screen.findByText(/Belum ada bukti pembayaran yang diunggah orang tua/)
    ).toBeDefined();

    cleanup();
    renderModal({
      load: async () =>
        snapshot([
          row({
            id: "pay-tolak",
            status: "rejected",
            rejectedAt: "2026-10-11T02:00:00.000Z",
            rejectReason: "Bukti buram",
            paymentProofUrl: null,
          }),
        ]),
    });
    expect(await screen.findByText("DITOLAK")).toBeDefined();
    expect(screen.getByText(/Ditolak: Bukti buram/)).toBeDefined();
    expect(screen.getByText(/Tanpa lampiran bukti/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Verifikasi" })).toBeNull();
  });
});
