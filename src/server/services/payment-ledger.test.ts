import { describe, expect, it, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { paymentAllocations, paymentReceipts, studentBookOrders } from "../../db/schema";
import { dropSeed, seedSchool, seedStudent } from "../lib/test-seed";
import {
  buildReceiptDraft,
  creditParts,
  paymentRowStatus,
  recomputeOrderPayment,
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

describe("arah struk (direction)", () => {
  // Regresi ADR-0019: refund keluar dulu tercatat sebagai struk terverifikasi
  // pada order yang sama, sehingga recompute membacanya sebagai pembayaran dan
  // menggelembungkan paidAmount. Hanya direction="in" yang boleh dikreditkan.
  it("struk keluar tidak menambah paidAmount order", async () => {
    const tag = `dir-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    const schoolId = await seedSchool(tag);
    const studentId = await seedStudent(tag, schoolId);
    const orderId = `ord-${tag}`;
    const now = "2026-10-30T00:00:00.000Z";
    try {
      await db.insert(studentBookOrders).values({
        id: orderId, orderNumber: `ORD-${tag.toUpperCase()}`, studentId, schoolId,
        orderType: "regular", paymentStatus: "unpaid", fulfillmentStatus: "waiting_preparation",
        totalAmount: 100_000, paidAmount: 0, createdAt: now, updatedAt: now,
      });

      const inbound = buildReceiptDraft(
        { studentId, schoolId, amount: 100_000, allocations: [{ orderId, kind: "buku", amount: 100_000, billAmount: 100_000 }], autoVerify: true },
        now,
        `rcp-in-${tag}`
      );
      const outbound = buildReceiptDraft(
        { studentId, schoolId, amount: 40_000, direction: "out", autoVerify: true, allocations: [{ orderId, kind: "buku", amount: 40_000, billAmount: 100_000 }] },
        now,
        `rcp-out-${tag}`
      );
      expect(inbound.ok).toBe(true);
      expect(outbound.ok).toBe(true);
      if (!inbound.ok || !outbound.ok) return;

      for (const built of [inbound, outbound]) {
        await db.insert(paymentReceipts).values(built.draft.receipt);
        await db.insert(paymentAllocations).values(built.draft.allocations);
      }

      const credit = await recomputeOrderPayment(db, "buku", orderId, now);
      expect(credit.ok).toBe(true);
      if (!credit.ok) return;
      expect(credit.paidAmount).toBe(100_000);
      expect(credit.paymentStatus).toBe("paid");
    } finally {
      await db.delete(paymentAllocations).where(eq(paymentAllocations.orderId, orderId));
      await db.delete(paymentReceipts).where(eq(paymentReceipts.studentId, studentId));
      await db.delete(studentBookOrders).where(eq(studentBookOrders.id, orderId));
      await dropSeed({ schoolIds: [schoolId], studentIds: [studentId] });
    }
  });
});
