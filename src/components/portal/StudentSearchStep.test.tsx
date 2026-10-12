import "./test-dom";
import { afterEach, describe, expect, it } from "bun:test";
import type { Dispatch, FormEvent, SetStateAction } from "react";
// Dinamis + top-level await: pastikan shim DOM sudah terpasang sebelum
// modul CJS @testing-library mengikat screen ke document.body.
const { cleanup, render, screen } = await import("@testing-library/react");
import { StudentSearchStep } from "./StudentSearchStep";
import type { NewStudentForm, SchoolOption, StudentSearchResult } from "../../lib/portal-types";

afterEach(() => {
  cleanup();
});

const EMPTY_NEW_STUDENT: NewStudentForm = {
  schoolId: "",
  name: "",
  gender: "male",
  gradeLevel: "1",
  curriculumType: "international",
  academicYear: "2026/2027",
  parentName: "",
  parentEmail: "",
  parentPhone: "",
};

const noop = (): void => {};
const noopDispatch: Dispatch<SetStateAction<NewStudentForm>> = () => {};
const noopSubmit = (_e: FormEvent): void => {
  void _e;
};

const student = (overrides: Partial<StudentSearchResult>): StudentSearchResult => ({
  id: "st-t5-ui",
  nis: "T5U001",
  name: "T5 UI Anak",
  gradeLevel: "6",
  curriculumType: "national",
  academicYear: "2026/2027",
  status: "graduated",
  isScholarship: false,
  schoolId: "school-t5-ui",
  schoolName: "Sekolah T5 UI",
  parentName: "Ortu UI",
  detectedStatus: "baru",
  currentGradeLevel: "6",
  targetGradeLevel: "6",
  canOrder: false,
  orderBlockedReason: "Data siswa masih menunggu verifikasi admin sekolah. Silakan coba lagi setelah disetujui.",
  ...overrides,
});

const renderStep = (results: StudentSearchResult[], onSelect: (st: StudentSearchResult) => void) => {
  const schools: SchoolOption[] = [{ id: "school-t5-ui", name: "Sekolah T5 UI", code: "T5-UI" }];
  return render(
    <StudentSearchStep
      schools={schools}
      searchSchoolId="school-t5-ui"
      setSearchSchoolId={noop}
      searchQuery="t5"
      setSearchQuery={noop}
      isSearching={false}
      searchResults={results}
      isNewStudentMode={false}
      setIsNewStudentMode={noop}
      newStudent={EMPTY_NEW_STUDENT}
      setNewStudent={noopDispatch}
      isSubmitting={false}
      onSearch={noopSubmit}
      onSelectStudent={onSelect}
      onRegister={noopSubmit}
    />
  );
};

describe("StudentSearchStep eligibility matrix (T5: UI reflects server flag)", () => {
  it("disables Pilih with a verification badge when canOrder is false", () => {
    let selected: StudentSearchResult | null = null;
    renderStep([student({})], (st) => {
      selected = st;
    });
    expect(screen.getByText("Menunggu verifikasi")).toBeDefined();
    const pilih = screen.getByRole("button", { name: "Pilih" }) as HTMLButtonElement;
    expect(pilih.disabled).toBe(true);
    expect(pilih.title).toMatch(/verifikasi/);
    expect(selected).toBeNull();
  });

  it("enables Pilih and forwards selection when canOrder is true", () => {
    let selected: StudentSearchResult | null = null;
    renderStep(
      [student({ id: "st-t5-ok", status: "active", detectedStatus: "aktif", canOrder: true, orderBlockedReason: null })],
      (st) => {
        selected = st;
      }
    );
    expect(screen.queryByText("Menunggu verifikasi")).toBeNull();
    const pilih = screen.getByRole("button", { name: "Pilih" }) as HTMLButtonElement;
    expect(pilih.disabled).toBe(false);
    pilih.click();
    expect((selected as StudentSearchResult | null)?.id).toBe("st-t5-ok");
  });

  it("treats a missing flag as orderable (back-compat with cached results)", () => {
    let selected: StudentSearchResult | null = null;
    const legacy = { ...student({}), canOrder: undefined } as unknown as StudentSearchResult;
    renderStep([legacy], (st) => {
      selected = st;
    });
    const pilih = screen.getByRole("button", { name: "Pilih" }) as HTMLButtonElement;
    expect(pilih.disabled).toBe(false);
    pilih.click();
    expect((selected as StudentSearchResult | null)?.id).toBe("st-t5-ui");
  });
});
