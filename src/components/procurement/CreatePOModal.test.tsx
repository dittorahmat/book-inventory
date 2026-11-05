import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, render, screen } = await import("@testing-library/react");
import { CreatePOModal } from "./CreatePOModal";
import type { Book } from "../../types";
import type { Supplier } from "./procurement-types";

afterEach(() => {
  cleanup();
});

const mockSuppliers: Supplier[] = [
  {
    id: "sup-cambridge",
    code: "SUP-CAM",
    name: "Cambridge University Press",
    contactPerson: "Agent",
    email: "cambridge@example.com",
  },
];

const mockCatalogBooks: Book[] = [
  {
    id: "b-cam-1",
    isbn: "978-CAM-001",
    title: "Cambridge Primary Math 1",
    author: "Author A",
    publisher: "Cambridge",
    category: "Primary",
    price: 150000,
    buyPrice: 100000,
    sellPrice: 150000,
    supplierIds: ["sup-cambridge"],
  },
  {
    id: "b-cam-2",
    isbn: "978-CAM-002",
    title: "Cambridge Primary Science 1",
    author: "Author B",
    publisher: "Cambridge",
    category: "Primary",
    price: 160000,
    buyPrice: 110000,
    sellPrice: 160000,
    supplierIds: ["sup-cambridge"],
  },
];

describe("CreatePOModal with supplier auto-population and demand buffer", () => {
  it("renders modal with buffer percent input and auto-populates supplier books", () => {
    render(
      <CreatePOModal
        suppliers={mockSuppliers}
        catalogBooks={mockCatalogBooks}
        defaultSupplierId="sup-cambridge"
        onClose={() => {}}
        onCreated={() => {}}
        reloadSuppliers={async () => mockSuppliers}
      />
    );

    // Header modal
    expect(screen.getByText("Terbitkan Purchase Order (PO) Baru")).toBeDefined();
    // Buffer label & input
    expect(screen.getByText(/Buffer \(%\):/i)).toBeDefined();
    // Kedua buku supplier Cambridge otomatis muncul sebagai item
    expect(screen.getByText("Cambridge Primary Math 1")).toBeDefined();
    expect(screen.getByText("Cambridge Primary Science 1")).toBeDefined();
  });
});
