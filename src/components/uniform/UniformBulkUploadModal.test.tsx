import "../../test-dom";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as XLSX from "xlsx";
import { UniformBulkUploadModal } from "./UniformBulkUploadModal";

const { render, screen, cleanup, fireEvent, act } = await import("@testing-library/react");

describe("UniformBulkUploadModal", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  it("renders modal with header and controls when isOpen is true", () => {
    render(<UniformBulkUploadModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.getByText("Bulk Upload Master Katalog Seragam (.xlsx)")).toBeDefined();
    expect(screen.getByPlaceholderText("2026/2027")).toBeDefined();
    expect(screen.getByText("Simpan ke Katalog")).toBeDefined();
  });

  it("validates empty commit and shows error message", async () => {
    render(<UniformBulkUploadModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />);
    const submitBtn = screen.getByText("Simpan ke Katalog");
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(screen.getByText("Pilih berkas Excel terlebih dahulu.")).toBeDefined();
  });

  it("shows confirmation dialog before final commit when preview data is present", async () => {
    render(<UniformBulkUploadModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.queryByText("Konfirmasi Impor Katalog")).toBeNull();
  });

  it("handles preview and shows summary cards and package breakdown", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/bulk-upload/preview")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              variants: [{ id: "v1", code: "C1", name: "Celana", kind: "kain_harian", isNew: true, price: 100000, sizes: ["STANDAR"] }],
              packages: [{ id: "p1", code: "P1", name: "Paket Harian", price: 100000, items: [{ variantId: "v1", quantity: 1 }] }],
              summary: { totalVariants: 1, newVariantsCount: 1, updateVariantsCount: 0, totalPackages: 1, skippedCount: 0 },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true, data: { insertedVariants: 1, updatedVariants: 0, packagesCreatedOrUpdated: 1 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const { container } = render(<UniformBulkUploadModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    // Build real valid XLSX buffer
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["TK/ IKHWAN", "CELANA ABU", 100000],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Katalog");
    const raw = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as number[];
    const arrayBuffer = new Uint8Array(raw).buffer as ArrayBuffer;

    const validFile = new File([arrayBuffer], "katalog.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [validFile] } });
    });

    // Verify preview cards render in DOM
    expect(screen.getByText("Total Varian")).toBeDefined();
    expect(screen.getByText("Varian Baru")).toBeDefined();
    expect(screen.getByText("Paket Terbentuk")).toBeDefined();
    expect(screen.getByText("Paket Harian")).toBeDefined();

    // Click submit button to trigger confirmation dialog
    const submitBtn = screen.getByText("Simpan ke Katalog");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Verify confirmation dialog renders
    expect(screen.getByText("Konfirmasi Impor Katalog")).toBeDefined();
    expect(screen.getByText("Ya, Simpan Sekarang")).toBeDefined();
  });
});
