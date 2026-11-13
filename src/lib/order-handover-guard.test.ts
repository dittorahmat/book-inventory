import { describe, expect, it } from "bun:test";
import { canHandoverBookOrder, canDispatchUniformOrder } from "./order-handover-guard";

describe("canHandoverBookOrder kanonik guard (ADR-0018)", () => {
  it("mengizinkan serah terima untuk status paid, partial, dan scholarship_approved", () => {
    expect(canHandoverBookOrder({ paymentStatus: "paid" })).toBe(true);
    expect(canHandoverBookOrder({ paymentStatus: "partial" })).toBe(true);
    expect(canHandoverBookOrder({ paymentStatus: "scholarship_approved" })).toBe(true);
  });

  it("menolak status unpaid tanpa diskresi finance", () => {
    expect(canHandoverBookOrder({ paymentStatus: "unpaid" })).toBe(false);
    expect(canHandoverBookOrder({ paymentStatus: "scholarship_pending" })).toBe(false);
  });

  it("mengizinkan status unpaid jika ada diskresi finance", () => {
    expect(canHandoverBookOrder({ paymentStatus: "unpaid", financeHandoverApproved: true })).toBe(true);
    expect(canHandoverBookOrder({ paymentStatus: "unpaid", financeHandoverApproved: 1 })).toBe(true);
  });
});

describe("canDispatchUniformOrder kanonik guard (§0.75)", () => {
  it("mengizinkan pengiriman seragam untuk paid, partial, dan scholarship_approved", () => {
    expect(canDispatchUniformOrder({ paymentStatus: "paid" })).toBe(true);
    expect(canDispatchUniformOrder({ paymentStatus: "partial" })).toBe(true);
    expect(canDispatchUniformOrder({ paymentStatus: "scholarship_approved" })).toBe(true);
  });

  it("menolak pengiriman seragam untuk unpaid murni dan beasiswa yang belum disetujui", () => {
    expect(canDispatchUniformOrder({ paymentStatus: "unpaid" })).toBe(false);
    expect(canDispatchUniformOrder({ paymentStatus: "scholarship_pending", orderType: "scholarship" })).toBe(false);
    expect(canDispatchUniformOrder({})).toBe(false);
  });
});
