import "../../test-dom";
import { afterEach, describe, expect, it, vi } from "bun:test";
import type { FormEvent } from "react";
// Dinamis + top-level await: shim DOM harus terpasang sebelum testing-library mengikat document.
const { cleanup, render, screen, fireEvent } = await import("@testing-library/react");
import { BookReturnFormStep } from "./BookReturnFormStep";
import type { BookReturnFormApi } from "./useBookReturn";
import type { PortalBookChoice, PortalOrderLookup } from "../../lib/portal-types";

afterEach(() => {
  cleanup();
});

const noopSubmit = (_e: FormEvent): void => {
  void _e;
};

const order: PortalOrderLookup = {
  id: "ord-rf-form",
  orderNumber: "ORD-202610-0008",
  studentId: "st-rf-form",
  studentName: "Ananda Form",
  nis: "20241002",
  schoolId: "school-rf-form",
  schoolName: "Sekolah Refund Form",
  packageId: "pkg-rf-form",
  packageName: "Paket Kelas 5",
  fulfillmentStatus: "picked_up",
  paymentStatus: "paid",
  handoverDate: "2026-10-20T00:00:00.000Z",
  handoverDeliveryNumber: "SJ-SERAH-002",
  handoverRecipient: "Ortu Form",
};

const books: PortalBookChoice[] = [
  { bookId: "book-rf-1", title: "Buku Matematika Kelas 5" },
  { bookId: "book-rf-2", title: "Buku IPA Kelas 5" },
];

const form = (overrides: Partial<BookReturnFormApi> = {}): BookReturnFormApi => ({
  bookChoices: books,
  booksLoading: false,
  booksError: null,
  selectedBookId: "",
  setSelectedBookId: () => {},
  reason: "",
  setReason: () => {},
  photoBase64: "",
  handlePhoto: () => {},
  submitting: false,
  ...overrides,
});

const renderForm = (props: Partial<Parameters<typeof BookReturnFormStep>[0]> = {}) =>
  render(
    <BookReturnFormStep
      order={order}
      form={form()}
      error={null}
      onSubmit={noopSubmit}
      onBack={() => {}}
      {...props}
    />
  );

describe("BookReturnFormStep", () => {
  it("memuat identitas pesanan dan pilihan judul buku dari paket pesanan", () => {
    renderForm();
    expect(screen.getByText("Ananda Form")).toBeTruthy();
    expect(screen.getByText(/ORD-202610-0008/)).toBeTruthy();
    expect(screen.getByText("Pilih judul buku...")).toBeTruthy();
  });

  it("menampilkan pratinjau foto setelah bukti terunggah", () => {
    renderForm({ form: form({ photoBase64: "data:image/png;base64,c2FtcGxl" }) });
    expect(screen.getByAltText("Pratinjau foto bukti kondisi buku")).toBeTruthy();
    expect(screen.getByText("Ganti Foto")).toBeTruthy();
  });

  it("mengunci tombol kirim saat pengiriman berjalan", () => {
    renderForm({
      form: form({ submitting: true, selectedBookId: "book-rf-1", reason: "Halaman sobek" }),
    });
    const submit = screen.getByRole("button", { name: /mengirim/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("menampilkan pesan galat server dan meneruskan aksi ganti pesanan", () => {
    const onBack = vi.fn();
    renderForm({ error: "Pesanan tidak sesuai dengan data siswa yang dipilih", onBack });
    expect(screen.getByRole("alert").textContent).toContain("tidak sesuai");
    fireEvent.click(screen.getByRole("button", { name: /ganti pesanan/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("menampilkan status memuat katalog buku", () => {
    renderForm({ form: form({ booksLoading: true }) });
    expect(screen.getByText(/Memuat daftar buku/i)).toBeTruthy();
  });
});
