import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { School } from "./types";
import { CatalogView } from "./views/CatalogView";
import { InventoryView } from "./views/InventoryView";
import { PackagesView } from "./views/PackagesView";
import { StudentOrdersView } from "./views/StudentOrdersView";
import { StudentsView } from "./views/StudentsView";
import { BookReturnsView } from "./views/BookReturnsView";
import { ProcurementView } from "./views/ProcurementView";
import { InternalProcurementView } from "./views/InternalProcurementView";
import { PublicOrderView } from "./views/PublicOrderView";
import { TransfersView } from "./views/TransfersView";
import { SettingsView } from "./views/SettingsView";
import { SalesReportView } from "./views/SalesReportView";
import { LoginView } from "./views/LoginView";
import { DashboardLoadingFallback } from "./views/DashboardFallback";
import { AppHeader } from "./components/layout/AppHeader";
import { AppTabsNavigation, AppMobileNavigation, TAB_IDS, type ActiveTab } from "./components/layout/AppTabsNavigation";
import { useSession, signOut } from "./lib/auth-client";
import { isCentralRole, type StaffRole } from "./lib/staff-roles";
import { getJson, postJson } from "./lib/api";
import { Loader2 } from "lucide-react";

const DashboardView = lazy(() => import("./views/DashboardView").then((m) => ({ default: m.DashboardView })));

function SeedNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-4">
      <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
        {message}
      </div>
    </div>
  );
}

export function App() {
  const { data: session, isPending } = useSession();
  const [schools, setSchools] = useState<School[]>([]);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  
  // Public vs Staff View state (default to public portal if unauthenticated or visiting /order)
  const isDirectOrderUrl = typeof window !== "undefined" && (window.location.pathname === "/order" || window.location.search.includes("mode=public"));
  const [showStaffLogin, setShowStaffLogin] = useState(!isDirectOrderUrl && typeof window !== "undefined" && window.location.pathname === "/admin");
  const [isPublicMode, setIsPublicMode] = useState(!session && !showStaffLogin);

  const sessionRole = (session?.user as unknown as { role?: StaffRole } | undefined)?.role;

  const loadSchools = useCallback(async () => {
    try {
      const list = await getJson<School[]>("/api/schools", "Gagal memuat daftar sekolah.");
      if (list.length === 0) {
        if (!isCentralRole(sessionRole)) {
          setSchools([]);
          setSeedNotice("Data sekolah belum tersedia. Hanya admin pusat yang dapat memuat data demo — silakan hubungi admin pusat.");
          return;
        }
        // Auto seed Cambridge & Al Wildan demo (central only)
        await postJson("/api/demo/seed", {}, "Gagal memuat data demo.");
        setSchools(await getJson<School[]>("/api/schools", "Gagal memuat daftar sekolah."));
        setSeedNotice(null);
      } else {
        setSchools(list);
        setSeedNotice(null);
      }
    } catch (err) {
      setSeedNotice(err instanceof Error ? err.message : "Gagal memuat daftar sekolah.");
    }
  }, [sessionRole]);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  // Adjust school assignment when user logs in
  useEffect(() => {
    if (session?.user && schools.length > 0) {
      const user = session.user as unknown as { role?: StaffRole; schoolId?: string | null };
      if (!isCentralRole(user.role) && user.schoolId) {
        const assigned = schools.find((s) => s.id === user.schoolId);
        if (assigned) setSelectedSchool(assigned);
      } else if (!selectedSchool && schools.length > 0) {
        // Default to HQ or first school
        const hq = schools.find((s) => s.type === "main") || schools[0];
        setSelectedSchool(hq);
      }
    }
  }, [session, schools, selectedSchool]);

  if (isPending) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center font-sans text-xs text-[#65676B]">
        <Loader2 className="w-6 h-6 animate-spin mr-2.5 text-[#1877F2]" /> Loading logistics workspace...
      </div>
    );
  }

  // 1. If user is in Public Portal mode (or unauthenticated and hasn't chosen staff login)
  if (!session && !showStaffLogin) {
    return (
      <div className="min-h-screen bg-[#F0F2F5]">
        {seedNotice && <SeedNotice message={seedNotice} />}
        <PublicOrderView
          onNavigateToStaffLogin={() => setShowStaffLogin(true)}
        />
      </div>
    );
  }

  // 2. If unauthenticated but wants staff login
  if (!session) {
    return (
      <div className="min-h-screen bg-[#F0F2F5]">
        {seedNotice && <SeedNotice message={seedNotice} />}
        <LoginView
          onLoginSuccess={() => {
            setShowStaffLogin(false);
            setIsPublicMode(false);
            loadSchools();
          }}
          onNavigateToPublicPortal={() => {
            setShowStaffLogin(false);
            setIsPublicMode(true);
          }}
        />
      </div>
    );
  }

  // 3. If authenticated staff wants to view the public portal
  if (isPublicMode) {
    return (
      <PublicOrderView 
        onNavigateToStaffLogin={() => setIsPublicMode(false)} 
      />
    );
  }

  const currentUser = session.user as unknown as { role: StaffRole; schoolId?: string | null; name: string };
  const userRole = currentUser.role;
  const userSchoolId = currentUser.schoolId ?? null;
  const isCentralAdmin = isCentralRole(userRole);

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#050505] flex flex-col font-sans antialiased">
      {/* Staff Header: solid blue top band + white nav band */}
      <header className="sticky top-0 z-40 shadow-xs">
        <AppHeader
          selectedSchool={selectedSchool}
          onSelectSchool={(school) => setSelectedSchool(school)}
          isCentralAdmin={isCentralAdmin}
          userName={currentUser.name}
          onOpenPublicPortal={() => setIsPublicMode(true)}
          onSignOut={() => signOut()}
        />
        <AppTabsNavigation
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          role={userRole}
        />
      </header>

      {seedNotice && <SeedNotice message={seedNotice} />}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-24 md:pb-8">
        {activeTab === "dashboard" && (
          <Suspense fallback={<DashboardLoadingFallback />}>
            <DashboardView
              activeSchool={selectedSchool}
              isCentralAdmin={isCentralAdmin}
              onNavigateTab={(tab) => {
                if ((TAB_IDS as readonly string[]).includes(tab)) setActiveTab(tab as ActiveTab);
              }}
            />
          </Suspense>
        )}
        {activeTab === "student_orders" && <StudentOrdersView activeSchool={selectedSchool} />}
        {activeTab === "students" && <StudentsView activeSchool={selectedSchool} />}
        {activeTab === "packages" && <PackagesView activeSchool={selectedSchool} />}
        {activeTab === "procurement" && <ProcurementView activeSchool={selectedSchool} userRole={userRole} />}
        {activeTab === "internal_orders" && (
          <InternalProcurementView
            activeSchool={selectedSchool}
            schools={schools}
            userRole={userRole}
            userSchoolId={userSchoolId}
          />
        )}
        {activeTab === "returns" && <BookReturnsView activeSchool={selectedSchool} />}
        {activeTab === "inventory" && <InventoryView activeSchool={selectedSchool} />}
        {activeTab === "catalog" && <CatalogView />}
        {activeTab === "transfers" && <TransfersView activeSchool={selectedSchool} />}
        {activeTab === "reports" && (
          <SalesReportView
            schools={schools}
            lockedSchoolId={isCentralAdmin ? null : currentUser?.schoolId ?? null}
          />
        )}
        {activeTab === "settings" && isCentralAdmin && (
          <SettingsView onSchoolsUpdated={() => loadSchools()} />
        )}
      </main>

      {/* Bottom Navigation Bar for Mobile (< md) */}
      <AppMobileNavigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        role={userRole}
      />
    </div>
  );
}
