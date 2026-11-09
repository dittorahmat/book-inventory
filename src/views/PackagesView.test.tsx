import "../test-dom";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { PackagesView } from "./PackagesView";
import type { School } from "../types";

const { render, screen, cleanup, fireEvent, act } = await import("@testing-library/react");

describe("PackagesView", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  const dummyWarehouse: School = {
    id: "sch-wh",
    name: "Gudang Logistik Pusat",
    code: "GUDANG",
    type: "warehouse",
  };

  const dummyBranch: School = {
    id: "sch-branch-1",
    name: "Al-Wildan 1",
    code: "AW1",
    type: "branch",
  };

  const mockSchools: School[] = [dummyWarehouse, dummyBranch];

  const dummyPackage = {
    id: "pkg-1",
    code: "PKG-01",
    name: "Paket Tematik 1",
    gradeLevel: "1",
    curriculumType: "TK" as const,
    academicYear: "2026/2027",
    price: 300000,
    totalItemsCount: 1,
    items: [],
  };

  it("shows location selector for logistics role and updates package stock when changed", async () => {
    const fetchedUrls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      fetchedUrls.push(url);
      if (url.includes("/api/packages/stock")) {
        const schoolId = url.includes("schoolId=sch-branch-1") ? "sch-branch-1" : "sch-wh";
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              "pkg-1": {
                packageId: "pkg-1",
                schoolId,
                readyBundleCount: schoolId === "sch-branch-1" ? 15 : 5,
                maxPossibleBundles: 10,
                looseStockBreakdown: [],
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/packages")) {
        return new Response(JSON.stringify({ success: true, data: [dummyPackage] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/books")) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
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
      render(
        <PackagesView
          activeSchool={dummyWarehouse}
          schools={mockSchools}
          userRole="warehouse_books_admin"
        />
      );
    });

    // Harus menampilkan dropdown pilih lokasi
    expect(screen.getByText("Pilih Lokasi Bundling")).toBeDefined();

    // Verifikasi initial query mengambil lokasi default activeSchool (sch-wh)
    expect(fetchedUrls.some((u) => u.includes("/api/packages/stock?schoolId=sch-wh"))).toBe(true);

    // Buka dropdown dan pilih cabang
    const selectTrigger = screen.getByRole("button", { name: /Pilih Lokasi Bundling/i });
    await act(async () => {
      fireEvent.click(selectTrigger);
    });

    const branchOption = screen.getByText("Al-Wildan 1");
    await act(async () => {
      fireEvent.click(branchOption);
    });

    // Memverifikasi fetch ulang terpanggil dengan ID cabang baru
    expect(fetchedUrls.some((u) => u.includes("/api/packages/stock?schoolId=sch-branch-1"))).toBe(true);
  });

  it("locks location to activeSchool for branch role without showing location selector", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/packages/stock")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              "pkg-1": {
                packageId: "pkg-1",
                schoolId: "sch-branch-1",
                readyBundleCount: 2,
                maxPossibleBundles: 3,
                looseStockBreakdown: [],
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/packages")) {
        return new Response(JSON.stringify({ success: true, data: [dummyPackage] }), {
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
      render(
        <PackagesView
          activeSchool={dummyBranch}
          schools={mockSchools}
          userRole="school_admin"
        />
      );
    });

    // Tidak boleh ada pemilih lokasi
    expect(screen.queryByText("Pilih Lokasi Bundling")).toBeNull();
  });
});
