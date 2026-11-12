import "../../test-dom";
import { describe, expect, it } from "bun:test";
import { UniformItemStep } from "./UniformItemStep";
import type { UniformOrder } from "./useUniformOrder";

const { render, screen } = await import("@testing-library/react");

describe("UniformItemStep", () => {
  it("renders Paket Bahan Seragam Harian with badge and olahraga with size options", () => {
    const mockOrder = {
      visiblePackages: [
        {
          id: "pkg-1",
          code: "PKG-1",
          name: "Paket Bahan Seragam Harian SD Ikhwan",
          academicYear: "2026/2027",
          price: 500000,
          readyQty: 10,
          bom: [{ variantId: "v-kain-1", variantName: "Kain Kemeja", kind: "kain_harian", size: "—", quantity: 1 }],
        },
      ],
      visibleVariants: [
        {
          id: "v-ol-1",
          code: "UNI-SD-IKH-BAJU_OLAHRAGA",
          name: "BAJU OLAHRAGA (SD Ikhwan)",
          kind: "olahraga" as const,
          gender: "male" as const,
          jenjang: "sd" as const,
          academicYear: "2026/2027",
          price: 150000,
          sizeChartUrl: null,
          sizes: ["S", "M"],
          sizeDetails: [
            { chartNumber: 7, size: "S", chestWidthCm: 42, bottomLengthCm: 76 },
            { chartNumber: 8, size: "M", chestWidthCm: 44, bottomLengthCm: 79 },
          ],
          stock: [{ size: "S", quantity: 5 }, { size: "M", quantity: 5 }],
        },
      ],
      catalog: null,
      packageQty: { "pkg-1": 1 },
      satuanQty: {},
      sizeFor: {},
      setSizeFor: () => {},
      bumpPackage: () => {},
      bumpSatuan: () => {},
      satuanOpen: true,
      student: { gradeLevel: "1" },
      total: 500000,
      itemCount: 1,
      backToSearch: () => {},
      setStep: () => {},
    } as unknown as UniformOrder;

    render(<UniformItemStep order={mockOrder} />);

    expect(screen.getByText("Paket Bahan Seragam Harian")).toBeDefined();
    expect(screen.getByText("Bahan Kain / Tanpa Ukuran")).toBeDefined();
    expect(screen.getByText("Seragam Olahraga")).toBeDefined();
    expect(screen.getByText("📏 Lihat Panduan Ukuran (cm)")).toBeDefined();
    expect(screen.queryByText("Kain Harian Satuan")).toBeNull();
  });
});
