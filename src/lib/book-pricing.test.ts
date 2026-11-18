import { describe, expect, test } from "bun:test";
import { calcLooseOrderTotal, resolvePublicBookTitle } from "./book-pricing";

describe("resolvePublicBookTitle (Kanonik judul buku portal publik)", () => {
  test("mengembalikan publicTitle jika tersedia dan tidak kosong", () => {
    expect(resolvePublicBookTitle({ title: "Judul Asli", publicTitle: "Judul Publik Ramah" })).toBe("Judul Publik Ramah");
    expect(resolvePublicBookTitle({ title: "Judul Asli", publicTitle: "  Judul Spasi  " })).toBe("Judul Spasi");
  });

  test("fallback ke judul asli jika publicTitle null, undefined, atau string kosong", () => {
    expect(resolvePublicBookTitle({ title: "Judul Asli", publicTitle: null })).toBe("Judul Asli");
    expect(resolvePublicBookTitle({ title: "Judul Asli", publicTitle: undefined })).toBe("Judul Asli");
    expect(resolvePublicBookTitle({ title: "Judul Asli", publicTitle: "" })).toBe("Judul Asli");
    expect(resolvePublicBookTitle({ title: "Judul Asli", publicTitle: "   " })).toBe("Judul Asli");
  });
});

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
