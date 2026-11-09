import "../test-dom";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { InventoryView } from "./InventoryView";
import type { School } from "../types";

const { render, screen, cleanup, fireEvent, act } = await import("@testing-library/react");

describe("InventoryView", () => {
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

  it("shows location selector for logistics role and updates overview when changed", async () => {
    const fetchedUrls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      fetchedUrls.push(url);
      if (url.includes("/api/stock-summary/overview")) {
        const schoolId = url.includes("schoolId=sch-branch-1") ? "sch-branch-1" : "sch-wh";
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                schoolId,
                looseTitleCount: 1,
                looseTotalQty: 10,
                looseAvailableQty: 8,
                packageTypeCount: 1,
                packageTotalQty: 5,
                packageReadyQty: 5,
                loose: [
                  {
                    bookId: "b-1",
                    isbn: "978-1",
                    title: `Buku Judul di ${schoolId}`,
                    coverUrl: null,
                    author: "Penulis",
                    sellPrice: 50000,
                    totalQty: 10,
                    availableQty: 8,
                    inTransitQty: 0,
                    byCondition: { new: 8, good: 2, fair: 0, damaged: 0 },
                    byStatus: { in_stock: 10, in_transit: 0, disposed: 0, lost: 0, sold: 0 },
                  },
                ],
                packages: [],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await act(async () => {
      render(
        <InventoryView
          activeSchool={dummyWarehouse}
          schools={mockSchools}
          userRole="warehouse_books_admin"
        />
      );
    });

    // Harus menampilkan dropdown pilih lokasi
    expect(screen.getByText("Pilih Lokasi Stok")).toBeDefined();
    expect(screen.getAllByText(/Gudang Logistik Pusat/i).length).toBeGreaterThan(0);

    // Verifikasi initial query mengambil lokasi default activeSchool (sch-wh)
    expect(fetchedUrls.some((u) => u.includes("schoolId=sch-wh"))).toBe(true);

    // Buka dropdown dan pilih cabang
    const selectTrigger = screen.getByRole("button", { name: /Pilih Lokasi Stok/i });
    await act(async () => {
      fireEvent.click(selectTrigger);
    });

    const branchOption = screen.getByText("Al-Wildan 1");
    await act(async () => {
      fireEvent.click(branchOption);
    });

    // Memverifikasi fetch ulang terpanggil dengan ID cabang baru
    expect(fetchedUrls.some((u) => u.includes("schoolId=sch-branch-1"))).toBe(true);
  });

  it("locks location to activeSchool for branch role without showing location selector", async () => {
    globalThis.fetch = (async (_input: RequestInfo | URL) => {
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              schoolId: "sch-branch-1",
              looseTitleCount: 0,
              looseTotalQty: 0,
              looseAvailableQty: 0,
              packageTypeCount: 0,
              packageTotalQty: 0,
              packageReadyQty: 0,
              loose: [],
              packages: [],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    await act(async () => {
      render(
        <InventoryView
          activeSchool={dummyBranch}
          schools={mockSchools}
          userRole="school_admin"
        />
      );
    });

    // Tidak boleh ada pemilih lokasi
    expect(screen.queryByText("Pilih Lokasi Stok")).toBeNull();
  });
});
