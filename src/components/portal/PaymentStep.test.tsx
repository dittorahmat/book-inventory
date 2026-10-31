import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, render, screen } = await import("@testing-library/react");
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

  it("disables submit button when paymentProofBase64 is empty for regular order", () => {
    const { rerender } = render(
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

    const submitBtn = screen.getByRole("button", { name: /Konfirmasi & Kirim Pesanan/i });
    expect(submitBtn.hasAttribute("disabled")).toBe(true);

    rerender(
      <PaymentStep
        pkg={samplePkg}
        draft={draft({ paymentProofBase64: "data:image/png;base64,sampleproof" })}
        actions={actions}
        isSatuan={false}
        isSubmitting={false}
        onFileUpload={noop}
        onBack={noop}
        onSubmit={noop}
      />
    );

    expect(submitBtn.hasAttribute("disabled")).toBe(false);
  });
});
