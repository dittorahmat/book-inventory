import "../../test-dom";
import { afterEach, describe, it, expect, mock } from "bun:test";
const { cleanup, render, screen, fireEvent, waitFor } = await import("@testing-library/react");
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

  it("validates that supplier is required when items exist", async () => {
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

    // Add item first
    const searchInput = screen.getByPlaceholderText(/Ketik nama atau kode seragam/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "sabuk" } });
    fireEvent.click(screen.getByText("Ikat Pinggang Logo Al-Wildan"));

    // Enter single quantity
    const qtyInputs = screen.getAllByRole("spinbutton");
    const singleQtyInput = qtyInputs.find((input) => (input as HTMLInputElement).placeholder === "0");
    if (singleQtyInput) {
      fireEvent.change(singleQtyInput, { target: { value: "15" } });
    }

    // Submit without choosing supplier
    const submitBtn = screen.getByRole("button", { name: /Terbitkan PO/i });
    fireEvent.click(submitBtn);

    // Expect supplier error feedback
    await waitFor(() => {
      const msgs = screen.getAllByText("Pilih mitra konveksi / supplier terlebih dahulu.");
      expect(msgs.length).toBeGreaterThanOrEqual(1);
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("validates that at least 1 size quantity must be greater than zero", async () => {
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

    // Add sized item
    const searchInput = screen.getByPlaceholderText(/Ketik nama atau kode seragam/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "olahraga" } });
    fireEvent.click(screen.getByText("Seragam Olahraga SD"));

    // Choose supplier
    const supplierDropdown = screen.getByText("— Pilih mitra konveksi —");
    fireEvent.click(supplierDropdown);
    fireEvent.click(screen.getByText("Konveksi Berkah Mandiri"));

    // Submit with all quantities still 0
    const submitBtn = screen.getByRole("button", { name: /Terbitkan PO/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const msgs = screen.getAllByText(
        /Setiap seragam yang dipilih wajib diisi kuantitasnya minimal 1 pcs/i
      );
      expect(msgs.length).toBeGreaterThanOrEqual(1);
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("successfully flattens matrix lines and submits payload", async () => {
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

    // Choose supplier
    fireEvent.click(screen.getByText("— Pilih mitra konveksi —"));
    fireEvent.click(screen.getByText("Konveksi Berkah Mandiri"));

    // Add sized item
    const searchInput = screen.getByPlaceholderText(/Ketik nama atau kode seragam/i);
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "olahraga" } });
    fireEvent.click(screen.getByText("Seragam Olahraga SD"));

    // Fill size S: 10, L: 20 (leave M and XL as 0)
    const inputs = screen.getAllByRole("spinbutton");
    // Inputs: [unitPrice, S, M, L, XL]
    const sizeSInput = inputs[1];
    const sizeLInput = inputs[3];

    fireEvent.change(sizeSInput, { target: { value: "10" } });
    fireEvent.change(sizeLInput, { target: { value: "20" } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: /Terbitkan PO/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    const callArgs = (handleSubmit.mock.calls as unknown[][])[0][0] as {
      supplierId: string;
      lines: Array<{ variantId: string; size?: string; quantityOrdered: number; unitPrice: number }>;
    };

    expect(callArgs.supplierId).toBe("sup-1");
    expect(callArgs.lines.length).toBe(2);
    expect(callArgs.lines).toEqual([
      { variantId: "var-olahraga-sd", size: "S", quantityOrdered: 10, unitPrice: 85000 },
      { variantId: "var-olahraga-sd", size: "L", quantityOrdered: 20, unitPrice: 85000 },
    ]);
  });
});
