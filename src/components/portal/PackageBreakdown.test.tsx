import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, render, screen } = await import("@testing-library/react");
import { PackageBreakdown } from "./PackageBreakdown";

afterEach(() => {
  cleanup();
});

describe("PackageBreakdown", () => {
  it("renders empty state when no items provided", () => {
    render(<PackageBreakdown items={[]} />);
    expect(screen.getByText(/Rincian buku belum tersedia/i)).toBeDefined();
  });

  it("renders titles and quantities without displaying unit prices", () => {
    render(
      <PackageBreakdown
        items={[
          { title: "Matematika Internasional Kelas 2", quantity: 1, unitPrice: 95000 },
          { title: "Weekly Progress Report (WPR)", quantity: 1, unitPrice: 750000 },
          { title: "Buku Tulis", quantity: 2, unitPrice: 20000 },
        ]}
      />
    );

    expect(screen.getByText("Matematika Internasional Kelas 2")).toBeDefined();
    expect(screen.getByText("Weekly Progress Report (WPR)")).toBeDefined();
    expect(screen.getByText("Buku Tulis")).toBeDefined();
    expect(screen.getByText("2 eks")).toBeDefined();
    // Harga satuan tidak boleh muncul di rincian paket
    expect(screen.queryByText(/Rp 95\.000/)).toBeNull();
    expect(screen.queryByText(/Rp 750\.000/)).toBeNull();
    expect(screen.queryByText(/Rp 20\.000/)).toBeNull();
  });
});
