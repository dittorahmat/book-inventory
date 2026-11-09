import { describe, expect, it } from "bun:test";
import type { Book } from "../../types";
import {
  type BookDemandItemInfo,
  buildSupplierPoItems,
  calcDemandQty,
  filterSupplierEligibleBooks,
} from "./po-demand-helpers";

const mockBooks: Book[] = [
  {
    id: "b-cnl-1",
    isbn: "978-CNL-001",
    title: "CNL Book 1",
    author: "Author A",
    publisher: "CNL",
    category: "Primary",
    price: 100000,
    buyPrice: 80000,
    sellPrice: 100000,
    supplierIds: ["sup-cnl"],
  },
  {
    id: "b-cnl-2",
    isbn: "978-CNL-002",
    title: "CNL Book 2",
    author: "Author B",
    publisher: "CNL",
    category: "Primary",
    price: 120000,
    buyPrice: 90000,
    sellPrice: 120000,
    supplierIds: ["sup-cnl"],
  },
  {
    id: "b-erl-1",
    isbn: "978-ERL-001",
    title: "Erlangga Book 1",
    author: "Author C",
    publisher: "Erlangga",
    category: "Primary",
    price: 90000,
    buyPrice: 70000,
    sellPrice: 90000,
    supplierIds: ["sup-erlangga"],
  },
  {
    id: "b-unmapped-1",
    isbn: "978-UNM-001",
    title: "Buku Umum Unmapped",
    author: "Author D",
    publisher: "General",
    category: "General",
    price: 50000,
    buyPrice: 30000,
    sellPrice: 50000,
    supplierIds: [],
  },
];

describe("po-demand-helpers: supplier eligibility & demand population", () => {
  it("filterSupplierEligibleBooks strictly returns books mapped to the given supplier", () => {
    const cnlBooks = filterSupplierEligibleBooks(mockBooks, "sup-cnl");
    expect(cnlBooks.map((b) => b.id)).toEqual(["b-cnl-1", "b-cnl-2"]);

    const erlBooks = filterSupplierEligibleBooks(mockBooks, "sup-erlangga");
    expect(erlBooks.map((b) => b.id)).toEqual(["b-erl-1"]);

    const emptySupplierBooks = filterSupplierEligibleBooks(mockBooks, "sup-non-existent");
    expect(emptySupplierBooks).toEqual([]);
  });

  it("buildSupplierPoItems populates only books with active demand by default", () => {
    const cnlBooks = filterSupplierEligibleBooks(mockBooks, "sup-cnl");
    const demandMap: Record<string, BookDemandItemInfo> = {
      "b-cnl-1": {
        bookId: "b-cnl-1",
        studentCount: 15,
        warehouseStock: 0,
        recommendedOrderQty: 17,
      },
      "b-cnl-2": {
        bookId: "b-cnl-2",
        studentCount: 0,
        warehouseStock: 5,
        recommendedOrderQty: 0,
      },
    };

    const items = buildSupplierPoItems(cnlBooks, mockBooks, demandMap, 10);
    // Hanya b-cnl-1 yang studentCount > 0, b-cnl-2 yang 0 tidak di-auto-populate
    expect(items.length).toBe(1);
    expect(items[0].bookId).toBe("b-cnl-1");
    expect(items[0].quantityOrdered).toBe(calcDemandQty(15, 10)); // ceil(15 * 1.1) = 17
  });

  it("buildSupplierPoItems can include zero demand books when explicitly requested", () => {
    const cnlBooks = filterSupplierEligibleBooks(mockBooks, "sup-cnl");
    const demandMap: Record<string, BookDemandItemInfo> = {
      "b-cnl-1": {
        bookId: "b-cnl-1",
        studentCount: 10,
        warehouseStock: 0,
        recommendedOrderQty: 11,
      },
    };

    const items = buildSupplierPoItems(cnlBooks, mockBooks, demandMap, 10, { includeZeroDemand: true });
    expect(items.length).toBe(2);
    expect(items.map((i) => i.bookId)).toEqual(["b-cnl-1", "b-cnl-2"]);
    expect(items[1].quantityOrdered).toBe(0);
  });
});
