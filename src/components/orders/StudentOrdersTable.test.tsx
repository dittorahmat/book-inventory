import "../../test-dom";
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { StudentOrdersTable } from "./StudentOrdersTable";
import type { StudentOrder } from "./order-types";

const { render, screen, cleanup } = await import("@testing-library/react");

describe("StudentOrdersTable", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  const dummyOrder: StudentOrder = {
    id: "ord-1",
    orderNumber: "ORD-001",
    studentId: "stu-1",
    studentName: "Budi Santoso",
    nis: "12345",
    gradeLevel: "1",
    schoolId: "sch-1",
    schoolName: "SD Utama",
    packageName: "Paket Tematik 1",
    orderType: "regular",
    paymentStatus: "paid",
    fulfillmentStatus: "waiting_preparation",
    totalAmount: 150000,
    paidAmount: 150000,
    createdAt: "2026-11-01T00:00:00Z",
  };

  it("renders order row without school column by default", () => {
    render(
      <StudentOrdersTable
        orders={[dummyOrder]}
        onOpenPayment={mock()}
        onOpenScholarship={mock()}
        onOpenHandover={mock()}
        onOpenDiscretion={mock()}
        onDeleteOrder={mock()}
        onMarkSatuanShipped={mock()}
        onOpenShipping={mock()}
        onSendInvoice={mock()}
        onReviewPayments={mock()}
      />
    );

    expect(screen.getByText("ORD-001")).toBeDefined();
    expect(screen.getByText("Budi Santoso")).toBeDefined();
    expect(screen.queryByText("SD Utama")).toBeNull();
  });

  it("renders school column and schoolName badge when showSchoolColumn is true", () => {
    render(
      <StudentOrdersTable
        orders={[dummyOrder]}
        showSchoolColumn={true}
        onOpenPayment={mock()}
        onOpenScholarship={mock()}
        onOpenHandover={mock()}
        onOpenDiscretion={mock()}
        onDeleteOrder={mock()}
        onMarkSatuanShipped={mock()}
        onOpenShipping={mock()}
        onSendInvoice={mock()}
        onReviewPayments={mock()}
      />
    );

    expect(screen.getByText("Sekolah / Cabang")).toBeDefined();
    expect(screen.getByText("SD Utama")).toBeDefined();
  });

  it("renders superseded status badge and reference to new order", () => {
    const supersededOrder: StudentOrder = {
      ...dummyOrder,
      id: "ord-old-123",
      fulfillmentStatus: "superseded",
      supersededByOrderId: "ord-new-456",
    };

    render(
      <StudentOrdersTable
        orders={[supersededOrder]}
        onOpenPayment={mock()}
        onOpenScholarship={mock()}
        onOpenHandover={mock()}
        onOpenDiscretion={mock()}
        onDeleteOrder={mock()}
        onMarkSatuanShipped={mock()}
        onOpenShipping={mock()}
        onSendInvoice={mock()}
        onReviewPayments={mock()}
      />
    );

    expect(screen.getByText(/TERTIMPA/i)).toBeDefined();
    expect(screen.getByText(/Digantikan: #EW-456/i)).toBeDefined();
  });
});
