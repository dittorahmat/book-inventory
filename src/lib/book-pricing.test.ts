import { describe, expect, test } from "bun:test";
import { calcLooseOrderTotal } from "./book-pricing";

describe("calcLooseOrderTotal (T7 portal optimistic total behind seam)", () => {
  const catalog = [
    { id: "b-new", sellPrice: 50000, price: 0 },
    { id: "b-legacy", sellPrice: 0, price: 42000 },
  ];

  test("sums effective sell price x quantity", () => {
    expect(
      calcLooseOrderTotal(
        [
          { bookId: "b-new", quantity: 1 },
          { bookId: "b-legacy", quantity: 2 },
        ],
        catalog
      )
    ).toBe(50000 + 2 * 42000);
  });

  test("unknown books count as zero, empty selection is zero", () => {
    expect(calcLooseOrderTotal([{ bookId: "ghost", quantity: 3 }], catalog)).toBe(0);
    expect(calcLooseOrderTotal([], catalog)).toBe(0);
  });
});
