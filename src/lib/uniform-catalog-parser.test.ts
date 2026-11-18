import { describe, expect, it } from "bun:test";
import {
  parseUniformCatalogRows,
  buildDefaultUniformPackages,
  type UniformCatalogRowInput,
} from "./uniform-catalog-parser";

describe("uniform-catalog-parser", () => {
  it("parses rows correctly into uniform variants with appropriate kinds and sizes", () => {
    const rows: UniformCatalogRowInput[] = [
      ["HARGA SERAGAM PER/ITEM 2026"],
      [],
      ["TK/ IKHWAN", "CELANA ABU", 180000],
      [null, "CELANA PUTIH", 180000],
      [null, "BAJU OLAHRAGA", 350000],
      ["TK/AKHWAT", "GAMIS BATIK", 196000],
      [null, "BAJU OLAHRAGA", 392000],
      ["SD/ IKHWAN ", "CELANA MERAH", 196000],
      [null, "BAJU OLAHRAGA", 392000],
      ["SMP/IKHWAN", "CELANA NAVY", 205000],
      [null, "BAJU OLAHRAGA", 409000],
      [" SMA AKHWAT", "GAMIS ABU-ABU", 246000],
      [null, "BAJU OLAHRAGA", 492000],
    ];

    const result = parseUniformCatalogRows(rows, {
      academicYear: "2026/2027",
      now: "2026-11-18T00:00:00.000Z",
    });

    expect(result.variants.length).toBe(11);

    // Kain harian TK Ikhwan
    const celanaAbu = result.variants.find((v) => v.code === "UNI-TK-IKH-CELANA_ABU");
    expect(celanaAbu).toBeDefined();
    expect(celanaAbu?.kind).toBe("kain_harian");
    expect(celanaAbu?.jenjang).toBe("tk");
    expect(celanaAbu?.gender).toBe("male");
    expect(celanaAbu?.price).toBe(180000);
    expect(celanaAbu?.sizes).toEqual(["STANDAR"]);

    // Olahraga TK Ikhwan (S-XL)
    const olahragaTk = result.variants.find((v) => v.code === "UNI-TK-IKH-BAJU_OLAHRAGA");
    expect(olahragaTk).toBeDefined();
    expect(olahragaTk?.kind).toBe("olahraga");
    expect(olahragaTk?.sizes).toEqual(["S", "M", "L", "XL"]);

    // Olahraga SD (S-4XL)
    const olahragaSd = result.variants.find((v) => v.code === "UNI-SD-IKH-BAJU_OLAHRAGA");
    expect(olahragaSd?.sizes).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL"]);

    // Olahraga SMP & SMA (S-5XL)
    const olahragaSmp = result.variants.find((v) => v.code === "UNI-SMP-IKH-BAJU_OLAHRAGA");
    expect(olahragaSmp?.sizes).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);

    const olahragaSma = result.variants.find((v) => v.code === "UNI-SMA-AKH-BAJU_OLAHRAGA");
    expect(olahragaSma?.sizes).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);
  });

  it("builds default uniform packages from kain_harian variants only", () => {
    const rows: UniformCatalogRowInput[] = [
      ["TK/ IKHWAN", "CELANA ABU", 180000],
      [null, "CELANA PUTIH", 180000],
      [null, "BAJU OLAHRAGA", 350000],
      ["TK/AKHWAT", "GAMIS BATIK", 196000],
    ];

    const result = parseUniformCatalogRows(rows, {
      academicYear: "2026/2027",
    });

    const packages = buildDefaultUniformPackages(result.variants, "2026/2027");
    expect(packages.length).toBe(2);

    const tkIkhwanPkg = packages.find((p) => p.code === "PKG-UNIF-TK-IKH-2026");
    expect(tkIkhwanPkg).toBeDefined();
    expect(tkIkhwanPkg?.jenjang).toBe("tk");
    expect(tkIkhwanPkg?.gender).toBe("male");
    expect(tkIkhwanPkg?.price).toBe(360000); // 180000 + 180000
    expect(tkIkhwanPkg?.items.length).toBe(2);
    expect(tkIkhwanPkg?.items.map((it) => it.variantId)).toEqual([
      "uv-uni-tk-ikh-celana-abu",
      "uv-uni-tk-ikh-celana-putih",
    ]);

    const tkAkhwatPkg = packages.find((p) => p.code === "PKG-UNIF-TK-AKH-2026");
    expect(tkAkhwatPkg).toBeDefined();
    expect(tkAkhwatPkg?.price).toBe(196000);
    expect(tkAkhwatPkg?.items.length).toBe(1);
  });
});
