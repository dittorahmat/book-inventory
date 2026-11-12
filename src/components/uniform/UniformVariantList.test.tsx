import "../../test-dom";
import { describe, expect, it } from "bun:test";
import { UniformVariantList } from "./UniformVariantList";
import type { UniformVariantRow } from "./uniform-admin-api";

const { render, screen } = await import("@testing-library/react");

describe("UniformVariantList", () => {
  const mockVariantRow: UniformVariantRow = {
    variant: {
      id: "uv-test-olahraga",
      code: "UNI-SD-IKH-BAJU_OLAHRAGA",
      name: "BAJU OLAHRAGA (SD Ikhwan)",
      kind: "olahraga",
      gender: "male",
      jenjang: "sd",
      academicYear: "2026/2027",
      price: 392000,
      sizeChartUrl: null,
    },
    sizes: ["S", "M", "L"],
    stock: [
      { size: "S", quantity: 15 },
      { size: "M", quantity: 20 },
      { size: "L", quantity: 0 },
    ],
  };

  it("renders multi-size uniform with detailed sizes, stock badges, and QuickSetStockButton in demo mode", () => {
    render(
      <UniformVariantList
        variants={[mockVariantRow]}
        searchQuery=""
        isDemoMode={true}
        onStockOverridden={() => {}}
        onEdit={() => {}}
      />
    );

    // Verifikasi nama dan kode
    expect(screen.getAllByText("BAJU OLAHRAGA (SD Ikhwan)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("UNI-SD-IKH-BAJU_OLAHRAGA").length).toBeGreaterThan(0);

    // Verifikasi chip ukuran dan stok per-size muncul di tabel desktop dan kartu mobile
    expect(screen.getAllByText("S:15").length).toBeGreaterThan(0);
    expect(screen.getAllByText("M:20").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L:0").length).toBeGreaterThan(0);

    // Verifikasi tombol QuickSetStockButton (title diawali 'Set Stok Cepat:')
    const buttons = screen.getAllByRole("button", { name: /Set Stok Cepat: BAJU OLAHRAGA \(SD Ikhwan\) \(Size S\)/i });
    expect(buttons.length).toBeGreaterThan(0);
  });
});
