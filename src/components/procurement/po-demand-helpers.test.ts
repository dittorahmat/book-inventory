import { describe, expect, it } from "bun:test";
import type { Book } from "../../types";
import {
  type BookDemandItemInfo,
  buildSupplierPoItems,
  calcBufferQty,
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
    id: "b-cnl-3",
    isbn: "978-CNL-003",
    title: "CNL Book 3 (No Demand)",
    author: "Author B",
    publisher: "CNL",
    category: "Primary",
    price: 130000,
    buyPrice: 95000,
    sellPrice: 130000,
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
    expect(cnlBooks.map((b) => b.id)).toEqual(["b-cnl-1", "b-cnl-2", "b-cnl-3"]);

    const erlBooks = filterSupplierEligibleBooks(mockBooks, "sup-erlangga");
    expect(erlBooks.map((b) => b.id)).toEqual(["b-erl-1"]);

    const emptySupplierBooks = filterSupplierEligibleBooks(mockBooks, "sup-non-existent");
    expect(emptySupplierBooks).toEqual([]);
  });

  it("calculates net demand: max(0, Up Buffer - warehouseStock)", () => {
    // 15 siswa, buffer 10% -> Up Buffer = ceil(15 * 1.1) = 17
    expect(calcBufferQty(15, 10)).toBe(17);
    // Stok 0 -> pesanan = 17
    expect(calcDemandQty(15, 10, 0)).toBe(17);
    // Stok 5 -> pesanan = 17 - 5 = 12
    expect(calcDemandQty(15, 10, 5)).toBe(12);
    // Stok 20 (berlebih) -> pesanan = 0
    expect(calcDemandQty(15, 10, 20)).toBe(0);
  });

  it("buildSupplierPoItems populates all supplier books with net demand and fallback default", () => {
    const cnlBooks = filterSupplierEligibleBooks(mockBooks, "sup-cnl");
    const demandMap: Record<string, BookDemandItemInfo> = {
      "b-cnl-1": {
        bookId: "b-cnl-1",
        studentCount: 15,
        warehouseStock: 5,
        recommendedOrderQty: 12, // 17 - 5
      },
      "b-cnl-2": {
        bookId: "b-cnl-2",
        studentCount: 0,
        warehouseStock: 5,
        recommendedOrderQty: 0,
      },
      "b-cnl-3": {
        bookId: "b-cnl-3",
        studentCount: 0,
        warehouseStock: 0,
        recommendedOrderQty: 0,
      },
    };

    const items = buildSupplierPoItems(cnlBooks, mockBooks, demandMap, 10);
    // Seluruh 3 buku milik supplier cnl wajib otomatis ter-populate
    expect(items.length).toBe(3);
    expect(items.map((i) => i.bookId)).toEqual(["b-cnl-1", "b-cnl-2", "b-cnl-3"]);

    // b-cnl-1: net demand 17 - 5 = 12
    expect(items[0].quantityOrdered).toBe(12);
    // b-cnl-2: demand 0, stok 5 > 0 -> default 0
    expect(items[1].quantityOrdered).toBe(0);
    // b-cnl-3: demand 0, stok 0 -> default 10 untuk isi stok kosong
    expect(items[2].quantityOrdered).toBe(10);
  });
});
