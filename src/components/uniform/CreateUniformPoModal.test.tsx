import "../../test-dom";
import { afterEach, describe, it, expect, mock } from "bun:test";
const { cleanup, render, screen, fireEvent } = await import("@testing-library/react");
import { CreateUniformPoModal } from "./CreateUniformPoModal";
import type { UniformVariantRow } from "./uniform-admin-api";

afterEach(() => {
  cleanup();
});

const mockSuppliers = [
  { id: "sup-1", name: "Konveksi Berkah Mandiri" },
  { id: "sup-2", name: "Mitra Textile Sejahtera" },
];

const mockVariants: UniformVariantRow[] = [
  {
    variant: {
      id: "var-olahraga-sd",
      code: "UNI-SD-OLAHRAGA",
      name: "Seragam Olahraga SD",
      kind: "set",
      gender: "unisex",
      jenjang: "SD",
      academicYear: "2026/2027",
      price: 85000,
      sizeChartUrl: null,
    },
    sizes: ["S", "M", "L", "XL"],
    stock: [],
  },
  {
    variant: {
      id: "var-khimar-sd",
      code: "UNI-SD-KHIMAR",
      name: "Khimar SD Putih",
      kind: "satuan",
      gender: "akhwat",
      jenjang: "SD",
      academicYear: "2026/2027",
      price: 55000,
      sizeChartUrl: null,
    },
    sizes: ["S", "M", "L"],
    stock: [],
  },
  {
    variant: {
      id: "var-sabuk-all",
      code: "UNI-ALL-SABUK",
      name: "Ikat Pinggang Logo Al-Wildan",
      kind: "satuan",
      gender: "unisex",
      jenjang: "SD",
      academicYear: "2026/2027",
      price: 25000,
      sizeChartUrl: null,
    },
    sizes: [], // All size
    stock: [],
  },
];

describe("CreateUniformPoModal", () => {
  it("renders searchable combobox and jenjang filter tags", () => {
    const handleClose = mock();
    const handleSubmit = mock(async () => {});
    const handleOpenSupplier = mock();

    render(
      <CreateUniformPoModal
        isOpen={true}
        suppliers={mockSuppliers}
        variants={mockVariants}
        busy={false}
        onClose={handleClose}
        onSubmit={handleSubmit}
        onOpenSupplierModal={handleOpenSupplier}
      />
    );

    expect(screen.getByText("Buat PO Konveksi Baru")).toBeTruthy();
    expect(screen.getByPlaceholderText(/Ketik nama atau kode seragam/i)).toBeTruthy();
    expect(screen.getByText("TK")).toBeTruthy();
    expect(screen.getByText("SD")).toBeTruthy();
    expect(screen.getByText("SMP")).toBeTruthy();
    expect(screen.getByText("SMA")).toBeTruthy();
  });

  it("selects an item and renders matrix size breakdown for sized uniform", async () => {
    const handleSubmit = mock(async () => {});

    render(
      <CreateUniformPoModal
        isOpen={true}
        suppliers={mockSuppliers}
        variants={mockVariants}
        busy={false}
        onClose={() => {}}
        onSubmit={handleSubmit}
        onOpenSupplierModal={() => {}}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Ketik nama atau kode seragam/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "olahraga" } });

    // Click item in dropdown popover
    const itemOption = screen.getByText("Seragam Olahraga SD");
    fireEvent.click(itemOption);

    // Should now show in PO line items
    expect(screen.getByText("Kuantitas Order per Ukuran (Pcs):")).toBeTruthy();
    expect(screen.getByText("S")).toBeTruthy();
    expect(screen.getByText("M")).toBeTruthy();
    expect(screen.getByText("L")).toBeTruthy();
    expect(screen.getByText("XL")).toBeTruthy();
  });

  it("renders single quantity for all-size items", async () => {
    render(
      <CreateUniformPoModal
        isOpen={true}
        suppliers={mockSuppliers}
        variants={mockVariants}
        busy={false}
        onClose={() => {}}
        onSubmit={async () => {}}
        onOpenSupplierModal={() => {}}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Ketik nama atau kode seragam/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "sabuk" } });

    const itemOption = screen.getByText("Ikat Pinggang Logo Al-Wildan");
    fireEvent.click(itemOption);

    expect(screen.getByText("Kuantitas (All Size / Tanpa Ukuran):")).toBeTruthy();
  });

  it("validates that supplier is required and prevents submit when empty", async () => {
    const handleSubmit = mock(async () => {});

    render(
      <CreateUniformPoModal
        isOpen={true}
        suppliers={mockSuppliers}
        variants={mockVariants}
        busy={false}
        onClose={() => {}}
        onSubmit={handleSubmit}
        onOpenSupplierModal={() => {}}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /Terbitkan PO/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
