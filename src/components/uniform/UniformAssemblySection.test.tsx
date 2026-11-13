import "../../test-dom";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { UniformAssemblySection } from "./UniformAssemblySection";

const { render, screen, cleanup, fireEvent, act } = await import("@testing-library/react");

describe("UniformAssemblySection Component", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  const dummyPackage = {
    package: {
      id: "upk-1",
      code: "UPK-01",
      name: "Paket Seragam TK Ikhwan",
      academicYear: "2026/2027",
      gender: "male" as const,
      price: 2148000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    bom: [
      {
        variantId: "uv-celana-abu",
        variantName: "CELANA ABU (TK Ikhwan)",
        kind: "kain_harian" as const,
        size: "—",
        quantity: 1,
      },
      {
        variantId: "uv-baju-or",
        variantName: "BAJU OLAHRAGA (TK Ikhwan)",
        kind: "olahraga" as const,
        size: "M",
        quantity: 1,
      },
    ],
    readyStock: 5,
  };

  const dummyVariants = [
    {
      variant: {
        id: "uv-celana-abu",
        code: "CA-01",
        name: "CELANA ABU (TK Ikhwan)",
        academicYear: "2026/2027",
        kind: "kain_harian" as const,
        jenjang: "tk",
        gender: "male" as const,
        price: 100000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      sizes: [],
      stock: [{ size: "—", quantity: 40 }],
    },
    {
      variant: {
        id: "uv-baju-or",
        code: "BO-01",
        name: "BAJU OLAHRAGA (TK Ikhwan)",
        academicYear: "2026/2027",
        kind: "olahraga" as const,
        jenjang: "tk",
        gender: "male" as const,
        price: 150000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      sizes: ["S", "M", "L"],
      stock: [
        { size: "S", quantity: 50 },
        { size: "M", quantity: 190 },
        { size: "L", quantity: 60 },
      ],
    },
  ];

  it("renders QuickSetStockButton for BOM items in accordion when demo mode is active", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/settings/demo-mode")) {
        return new Response(JSON.stringify({ success: true, data: { enabled: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/uniforms/packages")) {
        return new Response(JSON.stringify({ success: true, data: [dummyPackage] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/uniforms/variants")) {
        return new Response(JSON.stringify({ success: true, data: dummyVariants }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(<UniformAssemblySection defaultAcademicYear="2026/2027" />);
    });

    // Buka akordeon BOM
    const bomButton = screen.getByRole("button", { name: /Lihat BOM/i });
    await act(async () => {
      fireEvent.click(bomButton);
    });

    // Verifikasi stok bahan muncul
    expect(screen.getByText("40 unit")).toBeDefined();
    expect(screen.getByText("190 unit")).toBeDefined();

    // Verifikasi QuickSetStockButton muncul untuk paket dan untuk item BOM
    const buttons = screen.getAllByTitle(/Set Stok Cepat:/i);
    expect(buttons.length).toBeGreaterThanOrEqual(3); // 1 paket + 2 item BOM
  });

  it("does not render QuickSetStockButton for BOM items when demo mode is false", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/settings/demo-mode")) {
        return new Response(JSON.stringify({ success: true, data: { enabled: false } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/uniforms/packages")) {
        return new Response(JSON.stringify({ success: true, data: [dummyPackage] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/uniforms/variants")) {
        return new Response(JSON.stringify({ success: true, data: dummyVariants }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(<UniformAssemblySection defaultAcademicYear="2026/2027" />);
    });

    // Buka akordeon BOM
    const bomButton = screen.getByRole("button", { name: /Lihat BOM/i });
    await act(async () => {
      fireEvent.click(bomButton);
    });

    expect(screen.queryByTitle(/Set Stok Cepat:/i)).toBeNull();
  });

  it("renders potensi rakit badge and handles Maks button click", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/settings/demo-mode")) {
        return new Response(JSON.stringify({ success: true, data: { enabled: false } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/uniforms/packages")) {
        return new Response(JSON.stringify({ success: true, data: [dummyPackage] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/uniforms/variants")) {
        return new Response(JSON.stringify({ success: true, data: dummyVariants }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(<UniformAssemblySection defaultAcademicYear="2026/2027" />);
    });

    // Celana abu stok 40 (butuh 1). Baju or size M di BOM (stok 80).
    // Potensi botol leher = min(40/1, 80/1) = 40.
    expect(screen.getByText("Potensi Rakit")).toBeDefined();
    expect(screen.getByText("+40 Paket")).toBeDefined();

    const maksBtn = screen.getByRole("button", { name: "Maks (40)" });
    expect(maksBtn).toBeDefined();

    const qtyInput = screen.getByPlaceholderText("Jml unit") as HTMLInputElement;
    expect(qtyInput.value).toBe("");

    await act(async () => {
      fireEvent.click(maksBtn);
    });

    expect(qtyInput.value).toBe("40");
  });

  it("handles Maks button click with 0 potential by displaying informative error feedback (§0.63)", async () => {
    const emptyPackage = {
      ...dummyPackage,
      package: { ...dummyPackage.package, id: "upk-empty", name: "Paket Tanpa Bahan" },
      bom: [
        {
          variantId: "uv-habis",
          variantName: "KAIN HABIS",
          kind: "kain_harian" as const,
          size: "—",
          quantity: 1,
        },
      ],
      readyStock: 0,
    };

    const emptyVariants = [
      {
        variant: {
          id: "uv-habis",
          code: "KH-01",
          name: "KAIN HABIS",
          academicYear: "2026/2027",
          kind: "kain_harian" as const,
          jenjang: "tk",
          gender: "male" as const,
          price: 50000,
          sizeChartUrl: null,
        },
        sizes: [],
        stock: [{ size: "—", quantity: 0 }],
      },
    ];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/settings/demo-mode")) {
        return new Response(JSON.stringify({ success: true, data: { enabled: false } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/uniforms/packages")) {
        return new Response(JSON.stringify({ success: true, data: [emptyPackage] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/uniforms/variants")) {
        return new Response(JSON.stringify({ success: true, data: emptyVariants }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(<UniformAssemblySection defaultAcademicYear="2026/2027" />);
    });

    expect(screen.getByText("+0 Paket")).toBeDefined();
    const maksBtn = screen.getByRole("button", { name: "Maks (0)" });
    expect(maksBtn).toBeDefined();

    // Sesuai §0.63, tombol tetap dapat diklik untuk menerima umpan balik edukatif
    await act(async () => {
      fireEvent.click(maksBtn);
    });

    expect(screen.getByText(/tidak mencukupi untuk perakitan/i)).toBeDefined();
  });
});
