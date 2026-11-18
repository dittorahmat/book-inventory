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
});
