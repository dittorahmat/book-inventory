import { Suspense, lazy, type ReactNode } from "react";
import type { School } from "../../types";
import type { StaffRole } from "../../lib/staff-roles";
import type { ActiveTab } from "./staff-tabs";
import { DashboardLoadingFallback } from "../../views/DashboardFallback";
import { InternalProcurementView } from "../../views/InternalProcurementView";
import { SalesReportView } from "../../views/SalesReportView";
import { SettingsView } from "../../views/SettingsView";
import { StudentOrdersView } from "../../views/StudentOrdersView";
import { StudentsView } from "../../views/StudentsView";
import { UniformView } from "../../views/UniformView";
import { BookWarehouseView } from "../../views/BookWarehouseView";

const DashboardView = lazy(() => import("../../views/DashboardView").then((m) => ({ default: m.DashboardView })));

/**
 * Konteks shell staf: satu bentuk untuk semua tab, bukan 13 daftar prop ad-hoc.
 * Tab hanya boleh membaca dari sini agar penambahan tab tidak menyentuh App.
 */
export interface StaffShellContext {
  activeSchool: School | null;
  schools: School[];
  userRole: StaffRole;
  userSchoolId: string | null;
  isCentralAdmin: boolean;
  onSchoolsUpdated: () => void;
  onNavigateTab: (tab: string) => void;
}

/**
 * Satu renderer per `ActiveTab`. Tipe Record memaksa type-check gagal bila
 * sebuah tab ditambahkan ke TAB_IDS tanpa badan tampilan — daftar tab dan
 * tampilannya tidak bisa lagi menyimpang tanpa suara.
 */
export const STAFF_TAB_RENDERERS: Record<ActiveTab, (context: StaffShellContext) => ReactNode> = {
  dashboard: (context) => (
    <Suspense fallback={<DashboardLoadingFallback />}>
      <DashboardView
        activeSchool={context.activeSchool}
        isCentralAdmin={context.isCentralAdmin}
        onNavigateTab={context.onNavigateTab}
      />
    </Suspense>
  ),
  book_warehouse: (context) => <BookWarehouseView context={context} />,
  catalog: (context) => <BookWarehouseView context={context} defaultSection="catalog" />,
  packages: (context) => <BookWarehouseView context={context} defaultSection="packages" />,
  inventory: (context) => <BookWarehouseView context={context} defaultSection="inventory" />,
  students: (context) => (
    <StudentsView activeSchool={context.activeSchool} schools={context.schools} />
  ),
  student_orders: (context) => (
    <StudentOrdersView
      activeSchool={context.activeSchool}
      schools={context.schools}
      userRole={context.userRole}
    />
  ),
  uniforms: (context) => (
    <UniformView
      schools={context.schools}
      activeSchool={context.activeSchool}
      userRole={context.userRole}
      userSchoolId={context.userSchoolId}
    />
  ),
  procurement: (context) => <BookWarehouseView context={context} defaultSection="procurement" />,
  internal_orders: (context) => (
    <InternalProcurementView
      activeSchool={context.activeSchool}
      schools={context.schools}
      userRole={context.userRole}
      userSchoolId={context.userSchoolId}
    />
  ),
  returns: (context) => <BookWarehouseView context={context} defaultSection="returns" />,
  reconciliation: (context) => <BookWarehouseView context={context} defaultSection="reconciliation" />,
  reports: (context) => (
    <SalesReportView
      schools={context.schools}
      lockedSchoolId={context.isCentralAdmin ? null : context.userSchoolId}
    />
  ),
  settings: (context) =>
    context.isCentralAdmin ? <SettingsView onSchoolsUpdated={context.onSchoolsUpdated} /> : null,
};
