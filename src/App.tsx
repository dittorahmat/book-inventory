import { useState, useEffect, useCallback } from "react";
import { School } from "./types";
import { BranchSelector } from "./components/BranchSelector";
import { CatalogView } from "./views/CatalogView";
import { InventoryView } from "./views/InventoryView";
import { TransfersView } from "./views/TransfersView";
import { SettingsView } from "./views/SettingsView";
import { LoginView } from "./views/LoginView";
import { useSession, signOut } from "./lib/auth-client";
import { BookOpen, Layers, Truck, Settings, LogOut, Shield, School as SchoolIcon, Loader2 } from "lucide-react";

export function App() {
  const { data: session, isPending } = useSession();
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "inventory" | "transfers" | "settings">("inventory");

  const loadSchools = useCallback(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then(async (data) => {
        if (data.success) {
          if (data.data.length === 0) {
            // Auto seed Cambridge & Al Wildan demo
            await fetch("/api/demo/seed", { method: "POST" });
            const reRes = await fetch("/api/schools");
            const reData = await reRes.json();
            if (reData.success) {
              setSchools(reData.data);
            }
          } else {
            setSchools(data.data);
          }
        }
      });
  }, []);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  // Adjust school assignment when user logs in
  useEffect(() => {
    if (session?.user && schools.length > 0) {
      const user = session.user as any;
      if (user.role === "branch_admin" && user.schoolId) {
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
      <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center font-mono text-xs text-[#737373]">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#1A1A1A]" /> Loading logistics workspace...
      </div>
    );
  }

  if (!session) {
    return <LoginView onLoginSuccess={() => loadSchools()} />;
  }

  const currentUser = session.user as any;
  const isCentralAdmin = currentUser.role === "central_admin";

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-[#E5E5E0] bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1A1A1A] shrink-0"></span>
            <div className="truncate">
              <span className="font-serif text-base sm:text-lg tracking-tight font-bold truncate block sm:inline">
                School Book Logistics
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                Al Wildan
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Branch Selector: enabled for Central Admin, or locked for Branch Admin */}
            {isCentralAdmin ? (
              <div className="max-w-[150px] sm:max-w-none">
                <BranchSelector
                  selectedSchool={selectedSchool}
                  onSelectSchool={(school) => setSelectedSchool(school)}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 bg-[#F4F4F0] rounded text-xs font-mono text-[#404040]">
                <SchoolIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate max-w-[100px] sm:max-w-none">{selectedSchool?.name || "Assigned Branch"}</span>
              </div>
            )}

            {/* User Badge & Logout */}
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-[#E5E5E0]">
              <div className="text-right hidden md:block">
                <div className="text-xs font-medium text-[#1A1A1A]">{currentUser.name}</div>
                <div className="text-[10px] font-mono text-[#737373] flex items-center justify-end gap-1">
                  {isCentralAdmin ? (
                    <span className="text-amber-700 flex items-center gap-0.5 font-semibold">
                      <Shield className="w-2.5 h-2.5" /> HQ Central Admin
                    </span>
                  ) : (
                    <span>Branch Admin</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => signOut()}
                title="Sign Out"
                className="p-2 sm:p-1.5 text-[#737373] hover:text-[#1A1A1A] hover:bg-[#F4F4F0] rounded transition-colors"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation for Desktop (md and above) */}
        <div className="hidden md:flex max-w-6xl mx-auto px-6 gap-6 text-xs font-mono border-t border-[#F4F4F0]">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`py-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "inventory"
                ? "border-[#1A1A1A] text-[#1A1A1A] font-medium"
                : "border-transparent text-[#737373] hover:text-[#1A1A1A]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Branch Inventory
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`py-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "catalog"
                ? "border-[#1A1A1A] text-[#1A1A1A] font-medium"
                : "border-transparent text-[#737373] hover:text-[#1A1A1A]"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Book Catalog
          </button>
          <button
            onClick={() => setActiveTab("transfers")}
            className={`py-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "transfers"
                ? "border-[#1A1A1A] text-[#1A1A1A] font-medium"
                : "border-transparent text-[#737373] hover:text-[#1A1A1A]"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Inter-School Transfers
          </button>
          {isCentralAdmin && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`py-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === "settings"
                  ? "border-[#1A1A1A] text-[#1A1A1A] font-medium"
                  : "border-transparent text-[#737373] hover:text-[#1A1A1A]"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Settings & Hierarchy
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area: pb-24 on mobile so content isn't covered by bottom nav */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-8 pb-24 md:pb-8">
        {activeTab === "inventory" && <InventoryView activeSchool={selectedSchool} />}
        {activeTab === "catalog" && <CatalogView activeSchool={selectedSchool} />}
        {activeTab === "transfers" && <TransfersView activeSchool={selectedSchool} />}
        {activeTab === "settings" && isCentralAdmin && (
          <SettingsView
            currentUser={currentUser}
            onSchoolsUpdated={() => loadSchools()}
          />
        )}
      </main>

      {/* Bottom Navigation Bar for Mobile (< md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E5E5E0] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 px-2">
        <div className="grid grid-cols-3 auto-cols-fr sm:grid-cols-4 gap-1">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-md transition-colors ${
              activeTab === "inventory"
                ? "text-[#1A1A1A] font-semibold bg-[#F4F4F0]"
                : "text-[#737373] hover:text-[#1A1A1A]"
            }`}
          >
            <Layers className="w-5 h-5 mb-1" />
            <span className="text-[10px] tracking-tight">Inventory</span>
          </button>

          <button
            onClick={() => setActiveTab("catalog")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-md transition-colors ${
              activeTab === "catalog"
                ? "text-[#1A1A1A] font-semibold bg-[#F4F4F0]"
                : "text-[#737373] hover:text-[#1A1A1A]"
            }`}
          >
            <BookOpen className="w-5 h-5 mb-1" />
            <span className="text-[10px] tracking-tight">Catalog</span>
          </button>

          <button
            onClick={() => setActiveTab("transfers")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-md transition-colors ${
              activeTab === "transfers"
                ? "text-[#1A1A1A] font-semibold bg-[#F4F4F0]"
                : "text-[#737373] hover:text-[#1A1A1A]"
            }`}
          >
            <Truck className="w-5 h-5 mb-1" />
            <span className="text-[10px] tracking-tight">Transfers</span>
          </button>

          {isCentralAdmin && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`col-span-3 sm:col-span-1 flex flex-col items-center justify-center py-2 px-1 rounded-md transition-colors ${
                activeTab === "settings"
                  ? "text-[#1A1A1A] font-semibold bg-[#F4F4F0]"
                  : "text-[#737373] hover:text-[#1A1A1A]"
              }`}
            >
              <Settings className="w-5 h-5 mb-1" />
              <span className="text-[10px] tracking-tight">Settings</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
