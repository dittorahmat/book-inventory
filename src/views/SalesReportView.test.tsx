import "../test-dom";
import { afterEach, describe, expect, it } from "bun:test";
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
import { SalesReportView, SALES_REPORT_SUB_TABS } from "./SalesReportView";
import type { School } from "../types";

afterEach(() => {
  cleanup();
});

const mockSchools: School[] = [
  { id: "sch-1", name: "Al-Wildan 1", code: "AW1", type: "branch" },
  { id: "sch-2", name: "Al-Wildan 2", code: "AW2", type: "branch" },
];

describe("SalesReportView Navigation", () => {
  it("mendefinisikan sub-tab kanonik data-driven", () => {
    expect(SALES_REPORT_SUB_TABS).toBeDefined();
    expect(SALES_REPORT_SUB_TABS.length).toBe(2);
    expect(SALES_REPORT_SUB_TABS[0].id).toBe("sales_summary");
    expect(SALES_REPORT_SUB_TABS[1].id).toBe("finance_reconciliation");
  });

  it("merender tombol navigasi sub-tab dan berpindah tampilan", () => {
    render(<SalesReportView schools={mockSchools} lockedSchoolId={null} />);

    const reconTabBtn = screen.getByText("Rekonsiliasi Transfer Bank (Finance)");
    expect(reconTabBtn).toBeDefined();

    fireEvent.click(reconTabBtn);
    expect(screen.getByText("Filter Rekonsiliasi Transfer Bank")).toBeDefined();
  });
});
