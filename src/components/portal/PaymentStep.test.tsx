import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, render, screen } = await import("@testing-library/react");
import { PaymentStep } from "./PaymentStep";
import type { BookPackageOption } from "../../lib/portal-types";

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

describe("PaymentStep", () => {
  it("does not render 'Kirim ke rumah' option for package orders", () => {
    render(
      <PaymentStep
        pkg={samplePkg}
        orderType="regular"
        setOrderType={noop}
        scholarshipProofBase64=""
        setScholarshipProofBase64={noop}
        paymentChoice="full"
        setPaymentChoice={noop}
        transferAmount={900000}
        setTransferAmount={noop}
        bookAllocationAmount={900000}
        setBookAllocationAmount={noop}
        bankName="BCA"
        setBankName={noop}
        referenceNumber="REF123"
        setReferenceNumber={noop}
        paymentProofBase64=""
        setPaymentProofBase64={noop}
        notes=""
        setNotes={noop}
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
        orderType="regular"
        setOrderType={noop}
        scholarshipProofBase64=""
        setScholarshipProofBase64={noop}
        paymentChoice="full"
        setPaymentChoice={noop}
        transferAmount={900000}
        setTransferAmount={noop}
        bookAllocationAmount={900000}
        setBookAllocationAmount={noop}
        bankName="BCA"
        setBankName={noop}
        referenceNumber="REF123"
        setReferenceNumber={noop}
        paymentProofBase64=""
        setPaymentProofBase64={noop}
        notes=""
        setNotes={noop}
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
        orderType="regular"
        setOrderType={noop}
        scholarshipProofBase64=""
        setScholarshipProofBase64={noop}
        paymentChoice="full"
        setPaymentChoice={noop}
        transferAmount={900000}
        setTransferAmount={noop}
        bookAllocationAmount={900000}
        setBookAllocationAmount={noop}
        bankName="BCA"
        setBankName={noop}
        referenceNumber="REF123"
        setReferenceNumber={noop}
        paymentProofBase64="data:image/png;base64,sampleproof"
        setPaymentProofBase64={noop}
        notes=""
        setNotes={noop}
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
