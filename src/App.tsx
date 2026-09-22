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
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center font-sans text-xs text-[#65676B]">
        <Loader2 className="w-6 h-6 animate-spin mr-2.5 text-[#1877F2]" /> Loading logistics workspace...
      </div>
    );
  }

  if (!session) {
    return <LoginView onLoginSuccess={() => loadSchools()} />;
  }

  const currentUser = session.user as any;
  const isCentralAdmin = currentUser.role === "central_admin";

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#050505] flex flex-col font-sans antialiased">
      {/* Facebook Modern Header */}
      <header className="border-b border-[#E4E6EB] bg-white sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Al Wildan Logistics Crest Icon */}
            <div className="w-9 h-9 rounded-full bg-[#1877F2] flex items-center justify-center text-white shadow-sm shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="truncate">
              <span className="text-base sm:text-lg tracking-tight font-bold text-[#050505] truncate block sm:inline">
                School Logistics
              </span>
              <span className="hidden sm:inline-block ml-2 text-[11px] font-semibold text-[#1877F2] bg-[#E7F3FF] border border-[#1877F2]/20 px-2 py-0.5 rounded-full">
                Al Wildan
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Branch Selector */}
            {isCentralAdmin ? (
              <div className="max-w-[160px] sm:max-w-none">
                <BranchSelector
                  selectedSchool={selectedSchool}
                  onSelectSchool={(school) => setSelectedSchool(school)}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F0F2F5] rounded-full text-xs font-semibold text-[#050505] border border-[#CED0D4]">
                <SchoolIcon className="w-3.5 h-3.5 text-[#1877F2] shrink-0" />
                <span className="truncate max-w-[110px] sm:max-w-none">{selectedSchool?.name || "Assigned Branch"}</span>
              </div>
            )}

            {/* User Badge & Logout */}
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-[#E4E6EB]">
              <div className="text-right hidden md:block">
                <div className="text-xs font-semibold text-[#050505]">{currentUser.name}</div>
                <div className="text-[11px] text-[#65676B] flex items-center justify-end gap-1">
                  {isCentralAdmin ? (
                    <span className="text-[#1877F2] flex items-center gap-1 font-semibold">
                      <Shield className="w-3 h-3 text-[#1877F2]" /> HQ Central Admin
                    </span>
                  ) : (
                    <span>Branch Admin</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => signOut()}
                title="Sign Out"
                className="w-9 h-9 flex items-center justify-center text-[#050505] hover:bg-[#E4E6EB] rounded-full transition-colors bg-[#F0F2F5]"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4 text-[#65676B]" />
              </button>
            </div>
          </div>
        </div>

        {/* Facebook Centered/Left Navigation Tabs for Desktop */}
        <div className="hidden md:flex max-w-6xl mx-auto px-6 gap-2 text-sm border-t border-[#E4E6EB]/60">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`py-3 px-4 flex items-center gap-2 font-semibold transition-all relative ${
              activeTab === "inventory"
                ? "text-[#1877F2] border-b-[3px] border-[#1877F2]"
                : "text-[#65676B] hover:bg-[#F0F2F5] rounded-lg my-1 py-2 border-b-[3px] border-transparent"
            }`}
          >
            <Layers className="w-4 h-4" />
            Branch Inventory
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`py-3 px-4 flex items-center gap-2 font-semibold transition-all relative ${
              activeTab === "catalog"
                ? "text-[#1877F2] border-b-[3px] border-[#1877F2]"
                : "text-[#65676B] hover:bg-[#F0F2F5] rounded-lg my-1 py-2 border-b-[3px] border-transparent"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Book Catalog
          </button>
          <button
            onClick={() => setActiveTab("transfers")}
            className={`py-3 px-4 flex items-center gap-2 font-semibold transition-all relative ${
              activeTab === "transfers"
                ? "text-[#1877F2] border-b-[3px] border-[#1877F2]"
                : "text-[#65676B] hover:bg-[#F0F2F5] rounded-lg my-1 py-2 border-b-[3px] border-transparent"
            }`}
          >
            <Truck className="w-4 h-4" />
            Inter-School Transfers
          </button>
          {isCentralAdmin && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`py-3 px-4 flex items-center gap-2 font-semibold transition-all relative ${
                activeTab === "settings"
                  ? "text-[#1877F2] border-b-[3px] border-[#1877F2]"
                  : "text-[#65676B] hover:bg-[#F0F2F5] rounded-lg my-1 py-2 border-b-[3px] border-transparent"
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings & Hierarchy
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-24 md:pb-8">
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E4E6EB] shadow-lg pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 px-3">
        <div className="grid grid-cols-3 auto-cols-fr sm:grid-cols-4 gap-1.5">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors ${
              activeTab === "inventory"
                ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
                : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
            }`}
          >
            <Layers className="w-5 h-5 mb-1" />
            <span className="text-[11px] font-semibold">Inventory</span>
          </button>

          <button
            onClick={() => setActiveTab("catalog")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors ${
              activeTab === "catalog"
                ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
                : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
            }`}
          >
            <BookOpen className="w-5 h-5 mb-1" />
            <span className="text-[11px] font-semibold">Catalog</span>
          </button>

          <button
            onClick={() => setActiveTab("transfers")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors ${
              activeTab === "transfers"
                ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
                : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
            }`}
          >
            <Truck className="w-5 h-5 mb-1" />
            <span className="text-[11px] font-semibold">Transfers</span>
          </button>

          {isCentralAdmin && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`col-span-3 sm:col-span-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors ${
                activeTab === "settings"
                  ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
                  : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
              }`}
            >
              <Settings className="w-5 h-5 mb-1" />
              <span className="text-[11px] font-semibold">Settings</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
