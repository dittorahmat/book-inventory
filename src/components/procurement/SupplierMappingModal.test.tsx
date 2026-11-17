import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
import { SupplierMasterSection } from "./SupplierMasterSection";

describe("SupplierMasterSection & SupplierMappingModal (#499)", () => {
  afterEach(() => {
    cleanup();
  });

  const mockSuppliers = [
    { id: "sup-1", code: "SUP-CNL", name: "Chandra Naya Laksana" },
  ];

  it("menampilkan tombol Import & Mapping Supplier dan membuka modal saat diklik", () => {
    render(
      <SupplierMasterSection
        suppliers={mockSuppliers}
        onChanged={() => {}}
      />
    );

    const btn = screen.getByText("Import & Mapping Supplier");
    expect(btn).toBeDefined();

    fireEvent.click(btn);
    expect(screen.getByText("Sinkronkan supplier & relasi buku dari file Estimasi PO")).toBeDefined();
    expect(screen.getByText("Mulai Sinkronisasi")).toBeDefined();
  });
});
