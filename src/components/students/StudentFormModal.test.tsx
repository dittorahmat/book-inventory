import "../../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
import { StudentFormModal } from "./StudentFormModal";

describe("StudentFormModal Program Dropdown (#498)", () => {
  afterEach(() => {
    cleanup();
  });

  const mockSchools = [{ id: "sch-1", name: "AL WILDAN 1", code: "AW1" }];

  it("menampilkan opsi Program SD kanonik saat kelas 1 (SD) aktif dan dropdown dibuka", () => {
    render(
      <StudentFormModal
        schools={mockSchools}
        defaultSchoolId="sch-1"
        initial={null}
        saving={false}
        onClose={() => {}}
        onSave={async () => {}}
      />
    );

    // Nilai default untuk grade 1 adalah SD Internasional
    expect(screen.getByText("SD Internasional")).toBeDefined();

    // Buka dropdown Program
    fireEvent.click(screen.getByText("SD Internasional"));

    // Opsi SD Internasional dan Markaz Al-Qur'an (MQ) harus ada di listbox
    expect(screen.getByText("Markaz Al-Qur'an (MQ)")).toBeDefined();
  });

  it("menyesuaikan opsi program saat kelas diganti ke SMP (kelas 7)", () => {
    render(
      <StudentFormModal
        schools={mockSchools}
        defaultSchoolId="sch-1"
        initial={null}
        saving={false}
        onClose={() => {}}
        onSave={async () => {}}
      />
    );

    // Buka dropdown Kelas dan pilih Kelas 7
    fireEvent.click(screen.getByText("Kelas 1"));
    fireEvent.click(screen.getByText("Kelas 7"));

    // Default program untuk SMP menjadi Al-Wildan English (AE)
    expect(screen.getByText("Al-Wildan English (AE)")).toBeDefined();

    // Buka dropdown Program
    fireEvent.click(screen.getByText("Al-Wildan English (AE)"));
    expect(screen.getByText("Middle East (ME)")).toBeDefined();
    expect(screen.getByText("Dual International (DI)")).toBeDefined();
    expect(screen.getByText("Markaz Al-Qur'an (MQ)")).toBeDefined();
  });

  it("menyesuaikan opsi program saat kelas diganti ke TK / Preschool", () => {
    render(
      <StudentFormModal
        schools={mockSchools}
        defaultSchoolId="sch-1"
        initial={null}
        saving={false}
        onClose={() => {}}
        onSave={async () => {}}
      />
    );

    // Buka dropdown Kelas dan pilih TK / Preschool
    fireEvent.click(screen.getByText("Kelas 1"));
    fireEvent.click(screen.getByText("TK / Preschool"));

    // Program otomatis berubah ke TK / Preschool
    expect(screen.getAllByText("TK / Preschool").length).toBeGreaterThan(0);
  });
});
