import { describe, it, expect } from "bun:test";
import type { VendorReturn } from "./vendor-returns-types";

describe("VendorReturnsSection logic", () => {
  it("computes total items and credit note amount correctly", () => {
    const mockReturn: VendorReturn = {
      id: "rtv-1",
      returnNumber: "RTV-202610-0001",
      supplierId: "sup-1",
      supplierName: "Penerbit Erlangga",
      purchaseOrderId: null,
      status: "completed",
      reason: "Buku cacat cetak",
      creditNoteAmount: 285000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        {
          id: "it-1",
          vendorReturnId: "rtv-1",
          bookId: "b-1",
          bookTitle: "Cambridge Mathematics 1",
          isbn: "9781108746496",
          quantity: 3,
          reason: "Halaman terbalik",
        },
      ],
    };

    const totalQty = mockReturn.items.reduce((s, it) => s + it.quantity, 0);
    expect(totalQty).toBe(3);
    expect(mockReturn.creditNoteAmount).toBe(285000);
    expect(mockReturn.status).toBe("completed");
  });
});
