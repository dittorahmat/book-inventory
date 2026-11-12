import "../../test-dom";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { PackageCard } from "./PackageCard";
import type { Book } from "../../types";
import type { StockPotential } from "../../types/stock-summary";
import type { PackageRow } from "./usePackagesData";

const { render, screen, cleanup, act } = await import("@testing-library/react");

describe("PackageCard Component", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  const dummyPkg: PackageRow = {
    id: "pkg-demo-1",
    code: "PKG-01",
    name: "Paket Tematik Kelas 1",
    gradeLevel: "1",
    curriculumType: "TK" as const,
    academicYear: "2026/2027",
    price: 300000,
    totalItemsCount: 1,
    schoolIds: ["sch-wh"],
    items: [
      {
        id: "pki-1",
        bookId: "b-math-1",
        title: "Matematika 1",
        isbn: "ISBN-MATH-1",
        author: "Tim Math",
        quantity: 1,
      },
    ],
  };

  const dummyCatalogBooks: Book[] = [
    {
      id: "b-math-1",
      isbn: "ISBN-MATH-1",
      title: "Matematika 1",
      author: "Tim Math",
      publisher: "Penerbit X",
      price: 50000,
      sellPrice: 60000,
    },
  ];

  const dummyStock: StockPotential = {
    packageId: "pkg-demo-1",
    schoolId: "sch-wh",
    readyBundleCount: 5,
    maxPossibleBundles: 10,
    looseStockBreakdown: [
      {
        bookId: "b-math-1",
        title: "Matematika 1",
        isbn: "ISBN-MATH-1",
        quantityNeeded: 1,
        availableLooseStock: 15,
        maxBundlesFromComponent: 15,
      },
    ],
  };

  it("renders QuickSetStockButton for BOM items when demo mode is active", async () => {
    let stockOverriddenCalled = false;

    await act(async () => {
      render(
        <PackageCard
          pkg={dummyPkg}
          stock={dummyStock}
          catalogBooks={dummyCatalogBooks}
          isExpanded={true}
          isDemoMode={true}
          schoolId="sch-wh"
          onStockOverridden={() => {
            stockOverriddenCalled = true;
          }}
          onToggleExpand={() => {}}
          onOpenBundling={() => {}}
          deletePackage={async () => {}}
        />
      );
    });

    expect(stockOverriddenCalled).toBe(false);

    // Harus menampilkan teks stok satuan komponen
    expect(screen.getByText("Stok Satuan:")).toBeDefined();
    expect(screen.getByText("15 pcs")).toBeDefined();

    // Harus ada tombol QuickSetStockButton (title diawali "Set Stok Cepat:")
    const quickSetButtons = screen.getAllByTitle(/Set Stok Cepat:/i);
    expect(quickSetButtons.length).toBeGreaterThanOrEqual(2); // 1 untuk paket, 1 untuk buku BOM
  });

  it("does not render QuickSetStockButton for BOM items when demo mode is false", async () => {
    await act(async () => {
      render(
        <PackageCard
          pkg={dummyPkg}
          stock={dummyStock}
          catalogBooks={dummyCatalogBooks}
          isExpanded={true}
          isDemoMode={false}
          schoolId="sch-wh"
          onToggleExpand={() => {}}
          onOpenBundling={() => {}}
          deletePackage={async () => {}}
        />
      );
    });

    expect(screen.queryByTitle(/Set Stok Cepat:/i)).toBeNull();
  });
});
