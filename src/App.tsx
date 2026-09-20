import { useState, useEffect } from "react";
import { School } from "./types";
import { BranchSelector } from "./components/BranchSelector";
import { CatalogView } from "./views/CatalogView";
import { InventoryView } from "./views/InventoryView";
import { TransfersView } from "./views/TransfersView";
import { BookOpen, Layers, Truck } from "lucide-react";

export function App() {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "inventory" | "transfers">("inventory");

  // Initial seed check for demo
  useEffect(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then(async (data) => {
        if (data.success && data.data.length === 0) {
          // Auto create initial HQ and Branch
          await fetch("/api/schools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Central HQ School", code: "SCH-HQ", type: "main", address: "Jl. Pendidikan No. 1" }),
          });
          await fetch("/api/schools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Branch North School", code: "SCH-BR1", type: "branch", address: "Jl. Utara No. 10" }),
          });
          window.location.reload();
        }
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-[#E5E5E0] bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#1A1A1A]"></span>
            <span className="font-editorial text-lg tracking-tight font-semibold">
              School Book Logistics
            </span>
          </div>

          <div className="flex items-center gap-3">
            <BranchSelector
              selectedSchool={selectedSchool}
              onSelectSchool={(school) => setSelectedSchool(school)}
            />
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
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {activeTab === "inventory" && <InventoryView activeSchool={selectedSchool} />}
        {activeTab === "catalog" && <CatalogView activeSchool={selectedSchool} />}
        {activeTab === "transfers" && <TransfersView activeSchool={selectedSchool} />}
      </main>
    </div>
  );
}
