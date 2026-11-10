import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
import { ReceiveInternalShipmentModal } from "./ReceiveInternalShipmentModal";
import type { InternalShipment } from "../../lib/internal-orders-types";

afterEach(() => {
  cleanup();
});

const sampleShipment: InternalShipment = {
  id: "ishp-test-01",
  internalPoId: "ipo-test-01",
  destinationSchoolId: "school-branch-01",
  deliveryNoteNumber: "SJ-TEST-001",
  transferShipmentId: null,
  shippedDate: "2026-11-10",
  receivedDate: null,
  status: "in_transit",
  deliveryProofUrl: null,
  receivedByUserId: null,
  notes: "Pengiriman paket buku",
  createdAt: "2026-11-10T00:00:00.000Z",
  items: [
    {
      id: "line-01",
      shipmentId: "ishp-test-01",
      packageId: "pkg-01",
      packageName: "Paket Kelas 1",
      bookId: null,
      bookTitle: null,
      quantity: 5,
      isOutstandingFollowup: false,
      receivedCondition: null,
      receivedNotes: null,
    },
  ],
};

describe("ReceiveInternalShipmentModal (spec #382)", () => {
  it("displays validation feedback when submitted without delivery proof", () => {
    const handleClose = () => {};
    const handleReceived = () => {};

    render(
      <ReceiveInternalShipmentModal
        shipment={sampleShipment}
        onClose={handleClose}
        onReceived={handleReceived}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /Konfirmasi Terima/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Surat Jalan bertanda tangan wajib diunggah/i)).toBeDefined();
    expect(screen.getByText(/Wajib mengunggah scan\/foto dokumen Surat Jalan yang sudah ditandatangani/i)).toBeDefined();
  });
});
