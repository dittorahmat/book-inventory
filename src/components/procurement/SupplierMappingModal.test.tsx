import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
import { SupplierMasterSection } from "./SupplierMasterSection";
import { SupplierMappingModal } from "./SupplierMappingModal";

describe("SupplierMasterSection & SupplierMappingModal (#499)", () => {
  afterEach(() => {
    cleanup();
  });

  const mockSuppliers = [
    { id: "sup-1", code: "SUP-CNL", name: "Chandra Naya Laksana" },
  ];

  it("menampilkan tombol Import Supplier dan membuka modal saat diklik", () => {
    render(
      <SupplierMasterSection
        suppliers={mockSuppliers}
        onChanged={() => {}}
      />
    );

    const btn = screen.getByText("Import Supplier");
    expect(btn).toBeDefined();

    fireEvent.click(btn);
    expect(screen.getByText("Langkah 1: Masukkan sumber berkas spreadsheet")).toBeDefined();
    expect(screen.getByText("Muat & Review Data")).toBeDefined();
  });

  it("merender rincian supplier yang diproses saat modal dibuka", () => {
    render(
      <SupplierMappingModal
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    expect(screen.getByText("Import & Mapping Supplier Buku")).toBeDefined();
  });

  it("melakukan transisi ke langkah preview setelah menerima respons preview yang valid", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            totalSheetsFound: 10,
            totalSheetsProcessed: 2,
            totalBooksMatched: 15,
            suppliers: [
              {
                id: "sup-cnl",
                code: "SUP-CNL",
                name: "Chandra Naya Laksana",
                sheet: "CNL",
                isNew: false,
                booksMatchedCount: 15,
              },
            ],
          },
        }),
    })) as unknown as typeof fetch;

    try {
      render(<SupplierMappingModal onClose={() => {}} onSuccess={() => {}} />);
      const input = screen.getByPlaceholderText(/https:\/\/docs.google.com/);
      fireEvent.change(input, {
        target: { value: "https://docs.google.com/spreadsheets/d/test/edit" },
      });

      const btn = screen.getByText("Muat & Review Data");
      const form = btn.closest("form") || document.getElementById("supplier-mapping-form")!;
      fireEvent.submit(form);

      // Tunggu hingga elemen langkah 2 (preview) muncul
      const previewTitle = await screen.findByText("Langkah 2: Verifikasi & review data sebelum disimpan");
      expect(previewTitle).toBeDefined();
      expect(screen.getAllByText("Simpan & Terapkan Pemetaan").length).toBeGreaterThanOrEqual(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
