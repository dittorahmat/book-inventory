import { describe, expect, it } from "bun:test";
import { buildDefaultPackages } from "./import-uniform-catalog";

describe("import-uniform-catalog > buildDefaultPackages", () => {
  it("only bundles kain_harian into uniform package, keeping olahraga separate", () => {
    const mockVariants = [
      {
        id: "uv-kain-1",
        code: "UV-KAIN-1",
        name: "Celana Merah (SD Ikhwan)",
        kind: "kain_harian" as const,
        gender: "male" as const,
        jenjang: "sd" as const,
        academicYear: "2026/2027",
        price: 196000,
        sizeChartUrl: null,
        description: "Kain celana",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        sizes: ["—"],
      },
      {
        id: "uv-kain-2",
        code: "UV-KAIN-2",
        name: "Kemeja Putih (SD Ikhwan)",
        kind: "kain_harian" as const,
        gender: "male" as const,
        jenjang: "sd" as const,
        academicYear: "2026/2027",
        price: 196000,
        sizeChartUrl: null,
        description: "Kain kemeja",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        sizes: ["—"],
      },
      {
        id: "uv-ol-1",
        code: "UV-OL-1",
        name: "Baju Olahraga (SD Ikhwan)",
        kind: "olahraga" as const,
        gender: "male" as const,
        jenjang: "sd" as const,
        academicYear: "2026/2027",
        price: 350000,
        sizeChartUrl: "https://chart.url",
        description: "Olahraga jadi",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        sizes: ["S", "M", "L"],
      },
    ];

    const pkgs = buildDefaultPackages(mockVariants, "2026/2027");

    expect(pkgs).toHaveLength(1);
    const sdIkhwanPkg = pkgs[0];
    expect(sdIkhwanPkg.name).toBe("Paket Bahan Seragam Harian SD Ikhwan TA 2026/2027");
    // Hanya kain_harian (2 item kain), TIDAK mencakup olahraga
    expect(sdIkhwanPkg.items).toHaveLength(2);
    expect(sdIkhwanPkg.items.map((it) => it.variantId)).toEqual(["uv-kain-1", "uv-kain-2"]);
    // Harga paket = 196000 + 196000 = 392000 (tanpa olahraga 350000)
    expect(sdIkhwanPkg.price).toBe(392000);
  });
});
