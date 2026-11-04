import "../../test-dom";
import { afterEach, describe, it, expect } from "bun:test";
const { cleanup, render, screen } = await import("@testing-library/react");
import { StudentBulkUploadModal } from "./StudentBulkUploadModal";
import { StudentImportPreview } from "./StudentImportPreview";

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

  it("renders preview with unique badge and duplicate count breakdown", () => {
    render(
      <StudentImportPreview
        parsedStudents={[
          {
            nis: "1001",
            name: "Ahmad",
            gradeLevel: "1",
            academicYear: "2026/2027",
            curriculumType: "national",
            gender: "male",
            parentName: "Ayah",
            parentPhone: "0812345678",
          },
        ]}
        skippedRows={[]}
        sheetName="Kelas 1"
        totalRawRead={3}
      />
    );

    expect(screen.getByText("1 siswa unik siap diimpor")).toBeDefined();
    expect(screen.getByText("(2 duplikat NIS otomatis diabaikan)")).toBeDefined();
  });

  it("does not count skipped invalid rows as duplicates in student preview", () => {
    // 3 baris total: 1 valid, 2 baris format NIS/nama tidak valid, 0 duplikat
    render(
      <StudentImportPreview
        parsedStudents={[
          {
            nis: "1001",
            name: "Ahmad",
            gradeLevel: "1",
            academicYear: "2026/2027",
            curriculumType: "national",
            gender: "male",
            parentName: "Ayah",
            parentPhone: "0812345678",
          },
        ]}
        skippedRows={[
          { rowNumber: 2, raw: {}, reason: "NIS kosong" },
          { rowNumber: 3, raw: {}, reason: "Nama kosong" },
        ]}
        sheetName="Kelas 1"
        totalRawRead={3}
      />
    );

    expect(screen.getByText("1 siswa unik siap diimpor")).toBeDefined();
    expect(screen.queryByText(/duplikat NIS otomatis diabaikan/)).toBeNull();
  });
});
