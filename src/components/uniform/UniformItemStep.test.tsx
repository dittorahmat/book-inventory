import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
import { UniformItemStep } from "./UniformItemStep";
import type { UniformOrder } from "./useUniformOrder";

const { render, screen, cleanup, fireEvent } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
});

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

  it("still renders seragam olahraga section even when satuanOpen is false", () => {
    const mockOrder = {
      visiblePackages: [],
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
          sizeDetails: [],
          stock: [],
        },
      ],
      catalog: null,
      packageQty: {},
      satuanQty: {},
      sizeFor: {},
      setSizeFor: () => {},
      bumpPackage: () => {},
      bumpSatuan: () => {},
      satuanOpen: false,
      student: { gradeLevel: "1" },
      total: 0,
      itemCount: 0,
      backToSearch: () => {},
      setStep: () => {},
    } as unknown as UniformOrder;

    render(<UniformItemStep order={mockOrder} />);
    expect(screen.getByText("Seragam Olahraga")).toBeDefined();
    expect(screen.queryByText(/Pemesanan seragam olahraga sedang ditutup admin/)).toBeNull();
  });

  it("blocks continuing to step 3 and highlights missing olahraga size with red border and message", async () => {
    const { fireEvent } = await import("@testing-library/react");
    let nextStepCalled = false;
    const mockOrder = {
      visiblePackages: [],
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
          sizeDetails: [],
          stock: [],
        },
      ],
      catalog: null,
      packageQty: {},
      satuanQty: { "v-ol-1": 1 },
      sizeFor: {},
      setSizeFor: () => {},
      bumpPackage: () => {},
      bumpSatuan: () => {},
      satuanOpen: true,
      hasMissingOlahragaSize: true,
      missingOlahragaVariants: [
        {
          id: "v-ol-1",
          code: "UNI-SD-IKH-BAJU_OLAHRAGA",
          name: "BAJU OLAHRAGA (SD Ikhwan)",
          kind: "olahraga" as const,
        },
      ],
      student: { gradeLevel: "1" },
      total: 150000,
      itemCount: 1,
      backToSearch: () => {},
      setStep: () => {
        nextStepCalled = true;
      },
    } as unknown as UniformOrder;

    render(<UniformItemStep order={mockOrder} />);

    const lanjutBtn = screen.getByRole("button", { name: "Lanjut" });
    fireEvent.click(lanjutBtn);

    expect(nextStepCalled).toBe(false);
    expect(screen.getByText("Wajib memilih ukuran seragam olahraga sebelum melanjutkan.")).toBeDefined();
  });

  it("supports segmented toggle between Paket Lengkap and Satuan modes", async () => {
    const { fireEvent } = await import("@testing-library/react");
    let currentMode = "package";
    const mockOrder = {
      visiblePackages: [
        {
          id: "pkg-1",
          code: "PKG-1",
          name: "Paket Bahan Seragam Harian SD Ikhwan",
          academicYear: "2026/2027",
          price: 500000,
          readyQty: 10,
          bom: [],
        },
      ],
      visibleVariants: [
        {
          id: "v-kain-1",
          code: "UNI-KAIN-1",
          name: "CELANA MERAH (SD Ikhwan)",
          kind: "kain_harian" as const,
          gender: "male" as const,
          jenjang: "sd" as const,
          academicYear: "2026/2027",
          price: 196000,
          sizeChartUrl: null,
          sizes: ["—"],
          sizeDetails: [],
          stock: [{ size: "—", quantity: 5 }],
        },
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
          sizeDetails: [],
          stock: [],
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
      uniformMode: "package" as "package" | "satuan",
      setUniformMode: (m: "package" | "satuan") => {
        currentMode = m;
      },
      student: { gradeLevel: "1" },
      total: 500000,
      itemCount: 1,
      backToSearch: () => {},
      setStep: () => {},
    } as unknown as UniformOrder;

    const { rerender } = render(<UniformItemStep order={mockOrder} />);

    // In package mode, paket is shown, kain harian satuan is hidden
    expect(screen.getByText("Paket Bahan Seragam Harian")).toBeDefined();
    expect(screen.queryByText("Kain Harian Satuan")).toBeNull();

    // Click Satuan tab
    const satuanTab = screen.getByRole("button", { name: /Satuan/i });
    fireEvent.click(satuanTab);
    expect(currentMode).toBe("satuan");

    // Re-render in satuan mode
    rerender(<UniformItemStep order={{ ...mockOrder, uniformMode: "satuan" }} />);
    expect(screen.queryByText("Paket Bahan Seragam Harian")).toBeNull();
    expect(screen.getByText("Kain Harian Satuan")).toBeDefined();
    expect(screen.getByText("CELANA MERAH (SD Ikhwan)")).toBeDefined();
  });

  it("does not render raw stock numbers or readyQty in public UI (ADR-0024)", () => {
    const mockOrder = {
      visiblePackages: [
        {
          id: "pkg-1",
          code: "PKG-1",
          name: "Paket Bahan Seragam Harian SD Ikhwan",
          academicYear: "2026/2027",
          price: 500000,
          readyQty: 99,
          bom: [{ variantId: "v-kain-1", variantName: "Kain Kemeja", kind: "kain_harian", size: "—", quantity: 1 }],
        },
      ],
      visibleVariants: [
        {
          id: "v-kain-1",
          code: "UNI-SD-IKH-CELANA",
          name: "CELANA MERAH (SD Ikhwan)",
          kind: "kain_harian" as const,
          gender: "male" as const,
          jenjang: "sd" as const,
          academicYear: "2026/2027",
          price: 75000,
          sizeChartUrl: null,
          sizes: [],
          sizeDetails: [],
          stock: [{ size: "—", quantity: 42 }],
        },
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
          stock: [{ size: "S", quantity: 13 }, { size: "M", quantity: 17 }],
        },
      ],
      catalog: {
        variants: [
          { id: "v-kain-1", stock: [{ size: "—", quantity: 42 }] },
          { id: "v-ol-1", stock: [{ size: "S", quantity: 13 }, { size: "M", quantity: 17 }] },
        ],
      },
      packageQty: { "pkg-1": 1 },
      satuanQty: {},
      sizeFor: {},
      setSizeFor: () => {},
      bumpPackage: () => {},
      bumpSatuan: () => {},
      satuanOpen: true,
      uniformMode: "package" as "package" | "satuan",
      setUniformMode: () => {},
      student: { gradeLevel: "1" },
      total: 500000,
      itemCount: 1,
      backToSearch: () => {},
      setStep: () => {},
    } as unknown as UniformOrder;

    const { container } = render(<UniformItemStep order={mockOrder} />);
    expect(container.textContent).not.toContain("Siap kirim:");
    expect(container.textContent).not.toContain("Stok:");
  });

  it("filters olahraga size options strictly according to student jenjang (ADR-0024)", () => {
    // Siswa TK hanya boleh melihat S-XL (tidak boleh melihat 2XL, 3XL, 4XL, 5XL)
    const mockOrder = {
      visiblePackages: [],
      visibleVariants: [
        {
          id: "v-ol-tk",
          code: "UNI-TK-IKH-BAJU_OLAHRAGA",
          name: "BAJU OLAHRAGA (TK Ikhwan)",
          kind: "olahraga" as const,
          gender: "male" as const,
          jenjang: "tk" as const,
          academicYear: "2026/2027",
          price: 150000,
          sizeChartUrl: null,
          sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"], // varian memiliki ukuran meluap
          sizeDetails: [],
          stock: [],
        },
      ],
      catalog: null,
      packageQty: {},
      satuanQty: {},
      sizeFor: {},
      setSizeFor: () => {},
      bumpPackage: () => {},
      bumpSatuan: () => {},
      satuanOpen: true,
      uniformMode: "satuan" as const,
      setUniformMode: () => {},
      student: { gradeLevel: "TK" },
      total: 0,
      itemCount: 0,
      backToSearch: () => {},
      setStep: () => {},
    } as unknown as UniformOrder;

    render(<UniformItemStep order={mockOrder} />);
    // Buka dropdown ukuran olahraga
    const dropdownTrigger = screen.getByRole("button", { name: "Pilih Ukuran Olahraga (Wajib)" });
    fireEvent.click(dropdownTrigger);

    // Opsi ukuran TK hanya S, M, L, XL
    expect(screen.getByText("S")).toBeDefined();
    expect(screen.getByText("XL")).toBeDefined();
    expect(screen.queryByText("2XL")).toBeNull();
    expect(screen.queryByText("5XL")).toBeNull();
  });

  it("renders Khimar SD with default quantity 1 and allows changing size and quantity (Issue #533)", () => {
    let bumpedKey: string | null = null;
    let bumpedDelta: number | null = null;

    const mockOrder = {
      visiblePackages: [],
      visibleVariants: [
        {
          id: "uv-khimar-1",
          code: "UNI-SD-AKH-KHIMAR_HIJAU",
          name: "KHIMAR HIJAU (SD Akhwat)",
          kind: "kain_harian" as const,
          gender: "female" as const,
          jenjang: "sd" as const,
          academicYear: "2026/2027",
          price: 225000,
          sizeChartUrl: null,
          sizes: ["1", "4"],
          sizeDetails: [],
          stock: [],
        },
      ],
      catalog: null,
      packageQty: {},
      satuanQty: { "uv-khimar-1::4": 1 },
      sizeFor: { "uv-khimar-1": "4" },
      setSizeFor: () => {},
      bumpPackage: () => {},
      bumpSatuan: (key: string, delta: number) => {
        bumpedKey = key;
        bumpedDelta = delta;
      },
      satuanOpen: true,
      uniformMode: "package" as const,
      setUniformMode: () => {},
      student: { gradeLevel: "4" },
      total: 225000,
      itemCount: 1,
      backToSearch: () => {},
      setStep: () => {},
    } as unknown as UniformOrder;

    render(<UniformItemStep order={mockOrder} />);

    // Memastikan judul dan harga tertera
    expect(screen.getByText("KHIMAR HIJAU (SD Akhwat)")).toBeDefined();
    expect(screen.getByText("Rp 225.000")).toBeDefined();

    // Verifikasi stepper menunjukkan qty 1
    const qtyDisplays = screen.getAllByText("1");
    expect(qtyDisplays.length).toBeGreaterThan(0);

    // Klik tombol minus stepper untuk mengurangi qty
    const minusBtn = screen.getByRole("button", { name: "−" });
    fireEvent.click(minusBtn);
    expect(bumpedKey as string | null).toBe("uv-khimar-1::4");
    expect(bumpedDelta as number | null).toBe(-1);
  });
});
