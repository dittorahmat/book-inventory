import "../../test-dom";
import { afterEach, describe, it, expect } from "bun:test";
const { cleanup, render, screen } = await import("@testing-library/react");
import { BookBulkUploadModal } from "./BookBulkUploadModal";
import { BookImportPreview } from "./BookImportPreview";

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

  it("renders preview with unique badge and duplicate count breakdown", () => {
    render(
      <BookImportPreview
        parsedBooks={[
          { title: "Buku A", gradeLevel: "1", price: 50000, publisher: "Press A" },
          { title: "Buku B", gradeLevel: "2", price: 60000, publisher: "Press B" },
        ]}
        sheetName="Kelas 1-2"
        totalRawRead={5}
      />
    );

    expect(screen.getByText("2 judul buku unik siap diimpor")).toBeDefined();
    expect(screen.getByText("(3 duplikat judul & kelas otomatis diabaikan)")).toBeDefined();
  });
});
