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
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1A1A1A]"></span>
            <div>
              <span className="font-serif text-lg tracking-tight font-bold">
                School Book Logistics
              </span>
              <span className="ml-2 text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                Al Wildan
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Branch Selector: enabled for Central Admin, or locked for Branch Admin */}
            {isCentralAdmin ? (
              <BranchSelector
                selectedSchool={selectedSchool}
                onSelectSchool={(school) => setSelectedSchool(school)}
              />
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F4F4F0] rounded text-xs font-mono text-[#404040]">
                <SchoolIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>{selectedSchool?.name || "Assigned Branch"}</span>
              </div>
            )}

            {/* User Badge & Logout */}
            <div className="flex items-center gap-3 pl-3 border-l border-[#E5E5E0]">
              <div className="text-right hidden sm:block">
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
                className="p-1.5 text-[#737373] hover:text-[#1A1A1A] hover:bg-[#F4F4F0] rounded transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto px-6 flex gap-6 text-xs font-mono border-t border-[#F4F4F0]">
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
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
    </div>
  );
}
