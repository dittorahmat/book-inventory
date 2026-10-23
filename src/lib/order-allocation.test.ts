import { describe, expect, test } from "bun:test";
import { allocationViolation } from "./order-allocation";

describe("allocationViolation", () => {
  test("alokasi sah bila di antara minimum dan tagihan/struk", () => {
    expect(
      allocationViolation({ allocationAmount: 100_000, transferAmount: 100_000, billAmount: 100_000 })
    ).toBeNull();
  });

  test("di bawah minimum", () => {
    expect(allocationViolation({ allocationAmount: 0, transferAmount: 100_000, billAmount: 100_000 })).toBe(
      "below_minimum"
    );
  });

  test("melebihi tagihan order", () => {
    expect(
      allocationViolation({ allocationAmount: 150_000, transferAmount: 200_000, billAmount: 100_000 })
    ).toBe("above_bill");
  });

  test("melebihi nominal struk", () => {
    expect(
      allocationViolation({ allocationAmount: 100_000, transferAmount: 50_000, billAmount: 100_000 })
    ).toBe("above_receipt");
  });
});
