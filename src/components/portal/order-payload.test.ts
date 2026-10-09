import { describe, expect, test } from "bun:test";
import { buildFinalOrderPayload, type OrderTotalsInput } from "./order-payload";
import { effectiveSellPrice } from "../../lib/book-pricing";

const base: OrderTotalsInput = {
  studentId: "st-1",
  packageMode: true,
  packageId: "pkg-1",
  packagePrice: 900000,
  looseItems: [],
  looseTotal: 0,
  orderType: "regular",
  scholarshipProofBase64: "",
  transferAmount: 900000,
  bookAllocationAmount: 900000,
  bankName: "BCA",
  referenceNumber: "REF1",
  paymentProofBase64: "",
  notes: "  ",
};

describe("buildFinalOrderPayload", () => {
  test("paket reguler lolos dengan payment penuh", () => {
    const payload = buildFinalOrderPayload(base);
    expect(payload.studentId).toBe("st-1");
    expect(payload.packageId).toBe("pkg-1");
    expect(payload.payment?.bookAllocationAmount).toBe(900000);
    expect(payload.notes).toBeUndefined();
  });

  test("alokasi parsial diterima; alokasi melebihi total DITOLAK", () => {
    const partial = buildFinalOrderPayload({ ...base, bookAllocationAmount: 500000 });
    expect(partial.payment?.bookAllocationAmount).toBe(500000);

    expect(() =>
      buildFinalOrderPayload({ ...base, bookAllocationAmount: 1200000 })
    ).toThrow(/melebihi total tagihan/);
  });

  test("beasiswa tanpa bukti ditolak", () => {
    expect(() =>
      buildFinalOrderPayload({ ...base, orderType: "scholarship", scholarshipProofBase64: "" })
    ).toThrow(/beasiswa/i);
  });

  test("mode satuan tanpa item ditolak; dengan item lolos tanpa packageId", () => {
    expect(() => buildFinalOrderPayload({ ...base, packageMode: false })).toThrow(/satuan/);
    const payload = buildFinalOrderPayload({
      ...base,
      packageMode: false,
      looseItems: [{ bookId: "b-1", quantity: 2 }],
      looseTotal: 100000,
      transferAmount: 100000,
      bookAllocationAmount: 100000,
    });
    expect(payload.packageId).toBeUndefined();
    expect(payload.looseItems).toEqual([{ bookId: "b-1", quantity: 2 }]);
  });

  test("paket belum terkunci ditolak", () => {
    expect(() => buildFinalOrderPayload({ ...base, packageId: undefined })).toThrow(/terkunci/);
  });

  test("looseTotal paritas effectiveSellPrice (fallback harga lama) — T1", () => {
    const catalog = [
      { id: "b-new", sellPrice: 50000, price: 0 },
      { id: "b-legacy", sellPrice: 0, price: 42000 },
    ];
    const selections = [
      { bookId: "b-new", quantity: 1 },
      { bookId: "b-legacy", quantity: 2 },
    ];
    const looseTotal = selections.reduce((sum, sel) => {
      const book = catalog.find((b) => b.id === sel.bookId);
      return sum + effectiveSellPrice(book ?? {}) * sel.quantity;
    }, 0);
    expect(looseTotal).toBe(50000 + 2 * 42000);
    const payload = buildFinalOrderPayload({
      ...base,
      packageMode: false,
      looseItems: selections,
      looseTotal,
      transferAmount: looseTotal,
      bookAllocationAmount: looseTotal,
    });
    expect(payload.looseItems).toEqual(selections);
  });
});
