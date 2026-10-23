import { useState, useEffect, useCallback } from "react";
import { School } from "./types";
import { PublicOrderView } from "./views/PublicOrderView";
import { PaymentConfirmView } from "./views/PaymentConfirmView";
import { LoginView } from "./views/LoginView";
import { AppHeader } from "./components/layout/AppHeader";
import { AppTabsNavigation, AppMobileNavigation } from "./components/layout/AppTabsNavigation";
import { TAB_IDS, getVisibleTabsForRole, type ActiveTab } from "./components/layout/staff-tabs";
import { STAFF_TAB_RENDERERS } from "./components/layout/staff-tab-views";
import { useSession, signOut } from "./lib/auth-client";
import { isCentralRole, getDefaultTabForRole, type StaffRole } from "./lib/staff-roles";
import { getJson, postJson } from "./lib/api";
import { resolvePublicEntryTab } from "./lib/public-portal-url";
import { Loader2 } from "lucide-react";

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
  const sessionRole = (session?.user as unknown as { role?: StaffRole } | undefined)?.role;
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => getDefaultTabForRole(sessionRole));
  
  // Public vs Staff View state (default to public portal if unauthenticated or visiting /order)
  const isDirectOrderUrl = typeof window !== "undefined" && (window.location.pathname === "/order" || window.location.search.includes("mode=public"));
  const publicEntryTab =
    typeof window !== "undefined"
      ? resolvePublicEntryTab(window.location.pathname, window.location.search)
      : undefined;
  const payMatch = typeof window !== "undefined" ? window.location.pathname.match(/^\/bayar\/(buku|seragam)\/([^/]+)$/) : null;
  const [showStaffLogin, setShowStaffLogin] = useState(!isDirectOrderUrl && typeof window !== "undefined" && window.location.pathname === "/admin");
  const [isPublicMode, setIsPublicMode] = useState(!session && !showStaffLogin);

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

  // Lock active location to the account assignment (no location switching in header)
  useEffect(() => {
    if (session?.user && schools.length > 0) {
      const user = session.user as unknown as { schoolId?: string | null };
      const assigned = user.schoolId ? schools.find((s) => s.id === user.schoolId) : undefined;
      if (assigned && assigned.id !== selectedSchool?.id) setSelectedSchool(assigned);
    }
  }, [session, schools, selectedSchool]);

  // Guard tab aktif sesuai wewenang role pengguna (mencegah landing tab salah atau terlarang)
  useEffect(() => {
    if (sessionRole) {
      const allowedTabs = getVisibleTabsForRole(sessionRole);
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab(getDefaultTabForRole(sessionRole));
      }
    }
  }, [sessionRole, activeTab]);

  if (isPending) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center font-sans text-xs text-[#65676B]">
        <Loader2 className="w-6 h-6 animate-spin mr-2.5 text-[#1877F2]" /> Loading logistics workspace...
      </div>
    );
  }

  // 0. Link konfirmasi pembayaran invoice (publik, tanpa login)
  if (payMatch) {
    return <PaymentConfirmView kind={payMatch[1] as "buku" | "seragam"} token={payMatch[2]} />;
  }

  // 1. If user is in Public Portal mode (or unauthenticated and hasn't chosen staff login)
  if (!session && !showStaffLogin) {
    return (
      <div className="min-h-screen bg-[#F0F2F5]">
        {seedNotice && <SeedNotice message={seedNotice} />}
        <PublicOrderView
          onNavigateToStaffLogin={() => setShowStaffLogin(true)}
          initialTab={publicEntryTab}
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
          isCentralAdmin={isCentralAdmin}
          userRole={userRole}
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

      {/* Main Content Area — satu renderer per tab dari registry kanonik. */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-24 md:pb-8">
        {STAFF_TAB_RENDERERS[activeTab]({
          activeSchool: selectedSchool,
          schools,
          userRole,
          userSchoolId,
          isCentralAdmin,
          onSchoolsUpdated: loadSchools,
          onNavigateTab: (tab) => {
            if ((TAB_IDS as readonly string[]).includes(tab)) setActiveTab(tab as ActiveTab);
          },
        })}
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
