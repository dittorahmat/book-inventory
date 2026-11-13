import { describe, it, expect } from "bun:test";
import { calculateUniformAssemblyPotential } from "./uniform-assembly-potential";
import type { UniformPackageRow, UniformVariantRow } from "../components/uniform/uniform-admin-api";

describe("calculateUniformAssemblyPotential", () => {
  const dummyVariants: UniformVariantRow[] = [
    {
      variant: {
        id: "v-kain-1",
        code: "K-01",
        name: "Kain Kemeja",
        academicYear: "2026/2027",
        kind: "kain_harian",
        jenjang: "sd",
        gender: "male",
        price: 50000,
        sizeChartUrl: null,
      },
      sizes: [],
      stock: [{ size: "—", quantity: 20 }],
    },
    {
      variant: {
        id: "v-kain-2",
        code: "K-02",
        name: "Kain Celana",
        academicYear: "2026/2027",
        kind: "kain_harian",
        jenjang: "sd",
        gender: "male",
        price: 60000,
        sizeChartUrl: null,
      },
      sizes: [],
      stock: [{ size: "—", quantity: 15 }],
    },
    {
      variant: {
        id: "v-olahraga",
        code: "OR-01",
        name: "Set Olahraga",
        academicYear: "2026/2027",
        kind: "olahraga",
        jenjang: "sd",
        gender: "male",
        price: 100000,
        sizeChartUrl: null,
      },
      sizes: ["S", "M", "L"],
      stock: [
        { size: "S", quantity: 5 },
        { size: "M", quantity: 8 },
        { size: "L", quantity: 2 },
      ],
    },
  ];

  it("menghitung botol leher murni dari kain harian bila hanya kain di BOM", () => {
    const pkg: UniformPackageRow = {
      package: {
        id: "p-1",
        code: "PKG-01",
        name: "Paket Kain SD",
        academicYear: "2026/2027",
        price: 110000,
        description: null,
      },
      bom: [
        { variantId: "v-kain-1", variantName: "Kain Kemeja", kind: "kain_harian", size: "—", quantity: 2 },
        { variantId: "v-kain-2", variantName: "Kain Celana", kind: "kain_harian", size: "—", quantity: 1 },
      ],
      readyQty: 0,
    };

    // Kain 1: 20 / 2 = 10
    // Kain 2: 15 / 1 = 15
    // Bottleneck = 10
    const potential = calculateUniformAssemblyPotential(pkg, dummyVariants);
    expect(potential).toBe(10);
  });

  it("memperhitungkan stok olahraga spesifik jika ada di BOM dan ukuran diisi", () => {
    const pkg: UniformPackageRow = {
      package: {
        id: "p-2",
        code: "PKG-02",
        name: "Paket Lengkap SD",
        academicYear: "2026/2027",
        price: 210000,
        description: null,
      },
      bom: [
        { variantId: "v-kain-1", variantName: "Kain Kemeja", kind: "kain_harian", size: "—", quantity: 1 },
        { variantId: "v-olahraga", variantName: "Set Olahraga", kind: "olahraga", size: "—", quantity: 1 },
      ],
      readyQty: 0,
    };

    // Tanpa input size: hanya dibatasi kain harian (20)
    expect(calculateUniformAssemblyPotential(pkg, dummyVariants)).toBe(20);

    // Dengan size M (stok 8): bottleneck menjadi 8
    expect(calculateUniformAssemblyPotential(pkg, dummyVariants, "M")).toBe(8);

    // Dengan size L (stok 2): bottleneck menjadi 2
    expect(calculateUniformAssemblyPotential(pkg, dummyVariants, "L")).toBe(2);

    // Dengan size XL (tidak ada stok): bottleneck 0
    expect(calculateUniformAssemblyPotential(pkg, dummyVariants, "XL")).toBe(0);
  });

  it("mengembalikan 0 jika salah satu komponen BOM habis atau tidak ditemukan", () => {
    const pkg: UniformPackageRow = {
      package: {
        id: "p-3",
        code: "PKG-03",
        name: "Paket Kosong",
        academicYear: "2026/2027",
        price: 50000,
        description: null,
      },
      bom: [
        { variantId: "v-non-existent", variantName: "Kain Gaib", kind: "kain_harian", size: "—", quantity: 1 },
      ],
      readyQty: 0,
    };

    expect(calculateUniformAssemblyPotential(pkg, dummyVariants)).toBe(0);
  });

  it("mengembalikan 0 jika BOM kosong", () => {
    const pkg: UniformPackageRow = {
      package: {
        id: "p-4",
        code: "PKG-04",
        name: "Paket Tanpa BOM",
        academicYear: "2026/2027",
        price: 50000,
        description: null,
      },
      bom: [],
      readyQty: 0,
    };

    expect(calculateUniformAssemblyPotential(pkg, dummyVariants)).toBe(0);
  });
});
