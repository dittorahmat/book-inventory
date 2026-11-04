import "../../test-dom";
import { afterEach, describe, it, expect } from "bun:test";
const { cleanup, render, screen } = await import("@testing-library/react");
import { BookBulkUploadModal } from "./BookBulkUploadModal";

afterEach(() => {
  cleanup();
});

describe("BookBulkUploadModal", () => {
  it("renders modal with initial state, tabs and upload area", () => {
    render(<BookBulkUploadModal onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.getByText("Bulk Upload Katalog Buku")).toBeDefined();
    expect(screen.getByText("Format CSV")).toBeDefined();
    expect(screen.getByText("Upload Berkas (.xlsx / .xlsm / .csv)")).toBeDefined();
    expect(screen.getByText("Link Google Sheets / Drive Folder")).toBeDefined();
  });
});
