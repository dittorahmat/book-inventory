import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
// Dinamis + top-level await: pastikan shim DOM sudah terpasang sebelum
// modul CJS @testing-library mengikat screen ke document.body.
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
import { PaymentStep } from "./PaymentStep";
import type { BookPackageOption } from "../../lib/portal-types";
import type { OrderDraft, OrderDraftActions } from "./useOrderDraft";

afterEach(() => {
  cleanup();
});

const samplePkg: BookPackageOption = {
  id: "pkg-1",
  code: "PKG-1",
  name: "Paket Kelas 1 SD",
  gradeLevel: "1",
  curriculumType: "international",
  academicYear: "2026/2027",
  price: 900000,
  totalItemsCount: 5,
  items: [],
};

const noop = () => {};

const actions: OrderDraftActions = {
  edit: noop,
  chooseOrderType: noop,
  choosePaymentScheme: noop,
  attachProof: noop,
  setAmounts: noop,
  setHasTakenPackage: noop,
  setPaketKirim: noop,
  setWprPrice: noop,
  setReplacePendingOrderId: noop,
};

const draft = (overrides: Partial<OrderDraft> = {}): OrderDraft => ({
  orderType: "regular",
  scholarshipProofBase64: "",
  paymentChoice: "full",
  transferAmount: 900000,
  bookAllocationAmount: 900000,
  bankName: "BCA",
  referenceNumber: "REF123",
  paymentProofBase64: "",
  financeProofBase64: "",
  parentPhoneManual: "08123456789",
  notes: "",
  homeAddress: "",
  paketKirim: false,
  hasTakenPackage: null,
  wprPrice: 0,
  ...overrides,
});

describe("PaymentStep", () => {
  it("does not render 'Kirim ke rumah' option for package orders", () => {
    render(
      <PaymentStep
        pkg={samplePkg}
        draft={draft()}
        actions={actions}
        isSatuan={false}
        isSubmitting={false}
        onFileUpload={noop}
        onBack={noop}
        onSubmit={noop}
      />
    );

    expect(screen.queryByText("Kirim ke rumah")).toBeNull();
    expect(screen.queryByText("Serah-terima paket")).toBeNull();
  });

  it("keeps submit button clickable but displays feedback when submitted without proof", () => {
    let submitted = false;
    render(
      <PaymentStep
        pkg={samplePkg}
        draft={draft({ paymentProofBase64: "" })}
        actions={actions}
        isSatuan={false}
        isSubmitting={false}
        onFileUpload={noop}
        onBack={noop}
        onSubmit={(_e) => {
          submitted = true;
        }}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /Konfirmasi & Kirim Pesanan/i });
    expect(submitBtn.hasAttribute("disabled")).toBe(false);

    fireEvent.click(submitBtn);

    expect(submitted).toBe(false);
    expect(screen.getByText(/Formulir Belum Lengkap/i)).toBeDefined();
    const proofErrors = screen.getAllByText(/Bukti transfer pembayaran wajib diunggah/i);
    expect(proofErrors.length).toBeGreaterThanOrEqual(1);
  });
});
