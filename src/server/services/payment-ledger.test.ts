import { describe, expect, test } from "bun:test";
import {
  buildReceiptDraft,
  creditParts,
  paymentRowStatus,
  type ReceiptInput,
} from "./payment-ledger";

const baseInput = (overrides: Partial<ReceiptInput> = {}): ReceiptInput => ({
  studentId: "stu-1",
  schoolId: "sch-1",
  amount: 100_000,
  allocations: [{ orderId: "ord-1", kind: "buku", amount: 100_000 }],
  bankName: "BCA",
  referenceNumber: "REF-1",
  ...overrides,
});

describe("buildReceiptDraft", () => {
  test("membentuk struk + alokasi dengan id kanonik dan default bank", () => {
    const built = buildReceiptDraft(baseInput({ bankName: "  " }), "2026-10-23T00:00:00.000Z", "rcp-1");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.draft.receipt.bankName).toBe("Tanpa Bank");
    expect(built.draft.receipt.verifiedAt).toBeNull();
    expect(built.draft.allocations[0].id).toBe("rcp-1-buku-ord-1");
    expect(built.draft.allocations[0].receiptId).toBe("rcp-1");
  });

  test("autoVerify mengisi verifiedAt dan mempertahankan id alokasi pemanggil", () => {
    const built = buildReceiptDraft(
      baseInput({ autoVerify: true, verifiedByUserId: "usr-1" }),
      "2026-10-23T00:00:00.000Z",
      "rcp-2",
      { allocationId: () => "alc-rcp-2" }
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.draft.receipt.verifiedAt).toBe("2026-10-23T00:00:00.000Z");
    expect(built.draft.receipt.verifiedByUserId).toBe("usr-1");
    expect(built.draft.allocations[0].id).toBe("alc-rcp-2");
  });

  test("menolak alokasi melebihi nominal struk", () => {
    const built = buildReceiptDraft(
      baseInput({ amount: 50_000, allocations: [{ orderId: "ord-1", kind: "buku", amount: 60_000 }] }),
      "2026-10-23T00:00:00.000Z",
      "rcp-3"
    );
    expect(built.ok).toBe(false);
  });

  test("menolak alokasi melebihi tagihan order saat billAmount dikirim", () => {
    const built = buildReceiptDraft(
      baseInput({
        amount: 100_000,
        allocations: [{ orderId: "ord-1", kind: "buku", amount: 100_000, billAmount: 80_000 }],
      }),
      "2026-10-23T00:00:00.000Z",
      "rcp-3b"
    );
    expect(built.ok).toBe(false);
  });

  test("menolak order duplikat dalam satu struk", () => {
    const built = buildReceiptDraft(
      baseInput({
        amount: 200_000,
        allocations: [
          { orderId: "ord-1", kind: "buku", amount: 100_000 },
          { orderId: "ord-1", kind: "buku", amount: 100_000 },
        ],
      }),
      "2026-10-23T00:00:00.000Z",
      "rcp-4"
    );
    expect(built.ok).toBe(false);
  });
});

describe("creditParts", () => {
  test("ongkir ikut dihitung dan status diturunkan dari angka", () => {
    const parts = creditParts(
      { orderType: "regular", totalAmount: 900_000, shippingCost: 50_000, paymentStatus: "unpaid" },
      950_000
    );
    expect(parts.due).toBe(950_000);
    expect(parts.paymentStatus).toBe("paid");
  });

  test("pembayaran sebagian menghasilkan partial", () => {
    const parts = creditParts(
      { orderType: "regular", totalAmount: 900_000, shippingCost: 0, paymentStatus: "unpaid" },
      300_000
    );
    expect(parts.paymentStatus).toBe("partial");
  });
});

describe("paymentRowStatus", () => {
  test("rejected mengalahkan verified, verified mengalahkan pending", () => {
    expect(paymentRowStatus({ verifiedAt: null, rejectedAt: null })).toBe("pending");
    expect(paymentRowStatus({ verifiedAt: "x", rejectedAt: null })).toBe("verified");
    expect(paymentRowStatus({ verifiedAt: "x", rejectedAt: "y" })).toBe("rejected");
  });
});
