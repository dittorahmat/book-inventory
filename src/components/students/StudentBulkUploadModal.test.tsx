import "../../test-dom";
import { afterEach, describe, it, expect } from "bun:test";
const { cleanup, render, screen } = await import("@testing-library/react");
import { StudentBulkUploadModal } from "./StudentBulkUploadModal";

afterEach(() => {
  cleanup();
});

describe("StudentBulkUploadModal", () => {
  it("renders modal with initial state, tabs and school selector", () => {
    render(
      <StudentBulkUploadModal
        schoolId={null}
        schools={[{ id: "sch-1", name: "Al-Wildan 1", code: "AW1" }]}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );
    expect(screen.getByText("Bulk Upload Data Siswa")).toBeDefined();
    expect(screen.getByText("Format CSV")).toBeDefined();
    expect(screen.getByText("Upload Berkas (.xlsx / .xlsm / .csv)")).toBeDefined();
    expect(screen.getByText("Link Google Sheets / Drive Folder")).toBeDefined();
  });
});
