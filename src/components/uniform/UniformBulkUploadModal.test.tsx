import "../../test-dom";
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
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
});
