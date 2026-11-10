import { describe, expect, it } from "bun:test";
import {
  DEFAULT_EMPTY_STOCK_ORDER_QTY,
  calcBufferQty,
  calcDemandQty,
  resolveInitialOrderQty,
} from "./po-demand";

describe("po-demand: shared canonical formula", () => {
  it("calcBufferQty calculates ceiling with buffer percentage", () => {
    expect(calcBufferQty(0, 10)).toBe(0);
    expect(calcBufferQty(-5, 10)).toBe(0);
    expect(calcBufferQty(15, 10)).toBe(17); // 15 * 1.1 = 16.5 -> ceil = 17
    expect(calcBufferQty(15, 0)).toBe(15);
  });

  it("calcDemandQty deducts warehouse stock from buffer quantity", () => {
    // 15 siswa, buffer 10% -> Up Buffer = 17
    expect(calcDemandQty(15, 10, 0)).toBe(17);
    expect(calcDemandQty(15, 10, 5)).toBe(12);
    expect(calcDemandQty(15, 10, 20)).toBe(0); // overflow stock -> 0
  });

  it("resolveInitialOrderQty applies net demand or empty stock default", () => {
    // Siswa > 0: Net demand
    expect(resolveInitialOrderQty(15, 10, 5)).toBe(12);
    // Siswa 0 & stok 0 -> default empty stock
    expect(resolveInitialOrderQty(0, 10, 0)).toBe(DEFAULT_EMPTY_STOCK_ORDER_QTY);
    // Siswa 0 & stok > 0 -> 0
    expect(resolveInitialOrderQty(0, 10, 8)).toBe(0);
  });
});
