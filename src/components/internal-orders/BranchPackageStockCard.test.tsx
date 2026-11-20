import "../../test-dom";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
const { cleanup, render, screen } = await import("@testing-library/react");
import { BranchPackageStockCard } from "./BranchPackageStockCard";
import type { School } from "../../types";

afterEach(() => {
  cleanup();
});

const sampleSchool: School = {
  id: "school-cbg-01",
  name: "Al Wildan Cabang 01",
  code: "ALW-01",
  type: "branch",
};

describe("BranchPackageStockCard (Ticket #547)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/packages/stock")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              "pkg-01": {
                packageId: "pkg-01",
                schoolId: "school-cbg-01",
                readyBundleCount: 7,
                maxPossibleBundles: 10,
                looseStockBreakdown: [],
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/api/packages")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "pkg-01",
                code: "PKG-01",
                name: "Paket Tematik Kelas 1",
                gradeLevel: "1",
                curriculumType: "international",
                academicYear: "2026/2027",
                price: 150000,
                totalItemsCount: 3,
                items: [
                  {
                    id: "b-01",
                    bookId: "book-01",
                    title: "Buku Siswa Kelas 1",
                    isbn: "978-01",
                    author: "Penulis",
                    quantity: 1,
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/api/books")) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders branch package stock read-only without assembly or unbundling action controls", async () => {
    render(<BranchPackageStockCard school={sampleSchool} />);

    // Tunggu data dimuat
    expect(await screen.findByText("Ketersediaan Stok Paket Buku di Cabang")).toBeDefined();
    expect(await screen.findByText("Paket Tematik Kelas 1")).toBeDefined();
    expect(await screen.findByText("7 Paket")).toBeDefined();

    // Verifikasi strictly read-only: tidak ada tombol "Rakit Paket" atau "Bongkar"
    expect(screen.queryByText("Rakit Paket")).toBeNull();
    expect(screen.queryByText("Bongkar")).toBeNull();
    expect(screen.queryByText("Tarik ke Gudang & Bongkar")).toBeNull();
  });
});
