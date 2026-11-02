import "../../test-dom";
import { afterEach, describe, expect, it, vi } from "bun:test";
const { cleanup, render, screen, fireEvent } = await import("@testing-library/react");
import { AppHeader } from "./AppHeader";
import type { School } from "../../types";

afterEach(() => {
  cleanup();
});

const mockSchool: School = {
  id: "school-1",
  name: "Al Wildan 1 (Islamic School Pusat)",
  code: "AW1",
  type: "main",
  address: "Jakarta",
};

describe("AppHeader", () => {
  it("merender informasi staf dan cabang dengan benar", () => {
    render(
      <AppHeader
        selectedSchool={mockSchool}
        isCentralAdmin={true}
        userRole="central_admin"
        userName="Central Admin"
        onOpenPublicPortal={() => {}}
        onSignOut={() => {}}
      />
    );

    expect(screen.getByText("School Logistics")).toBeTruthy();
    expect(screen.getByText("Al Wildan 1 (Islamic School Pusat)")).toBeTruthy();
    expect(screen.getByText("Central Admin")).toBeTruthy();
    expect(screen.getByLabelText("Sign Out")).toBeTruthy();
  });

  it("memanggil onSignOut saat tombol logout diklik", () => {
    const handleSignOut = vi.fn();
    render(
      <AppHeader
        selectedSchool={mockSchool}
        isCentralAdmin={false}
        userRole="branch_admin"
        userName="School Admin"
        onOpenPublicPortal={() => {}}
        onSignOut={handleSignOut}
      />
    );

    const signOutBtn = screen.getByLabelText("Sign Out");
    fireEvent.click(signOutBtn);
    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });

  it("menonaktifkan tombol dan menampilkan spinner saat isSigningOut true", () => {
    const handleSignOut = vi.fn();
    render(
      <AppHeader
        selectedSchool={mockSchool}
        isCentralAdmin={false}
        userRole="branch_admin"
        userName="School Admin"
        isSigningOut={true}
        onOpenPublicPortal={() => {}}
        onSignOut={handleSignOut}
      />
    );

    const signOutBtn = screen.getByLabelText("Sign Out");
    expect(signOutBtn.hasAttribute("disabled")).toBe(true);
    fireEvent.click(signOutBtn);
    expect(handleSignOut).not.toHaveBeenCalled();
  });
});
