import { useState, useEffect, useCallback } from "react";
import { School } from "../types";
import { BundlingModal } from "../components/BundlingModal";
import { 
  Package, 
  Layers, 
  Boxes, 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  BookOpen 
} from "lucide-react";

interface BookPackage {
  id: string;
  code: string;
  name: string;
  gradeLevel: string;
  curriculumType: "international" | "national";
  academicYear: string;
  price: number;
  description?: string;
  totalItemsCount: number;
  items: Array<{
    id: string;
    bookId: string;
    title: string;
    isbn: string;
    author: string;
    category?: string;
    quantity: number;
  }>;
}

interface StockPotential {
  packageId: string;
  schoolId: string;
  readyBundleCount: number;
  maxPossibleBundles: number;
  looseStockBreakdown: Array<{
    bookId: string;
    title: string;
    isbn: string;
    quantityNeeded: number;
    availableLooseStock: number;
    maxBundlesFromComponent: number;
  }>;
}

interface PackagesViewProps {
  activeSchool: School | null;
}

export function PackagesView({ activeSchool }: PackagesViewProps) {
  const [packages, setPackages] = useState<BookPackage[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, StockPotential>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCurriculum, setSelectedCurriculum] = useState<string>("all");
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [modalPkg, setModalPkg] = useState<BookPackage | null>(null);
  const [modalMode, setModalMode] = useState<"bundle" | "unbundle">("bundle");

  const loadPackagesData = useCallback(async () => {
    if (!activeSchool) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/packages");
      const data = await res.json();
      if (data.success) {
        setPackages(data.data);

        // Fetch stock potentials per package for active school
        const stockPromises = data.data.map(async (pkg: BookPackage) => {
          try {
            const sRes = await fetch(`/api/packages/${pkg.id}/stock/${activeSchool.id}`);
            const sData = await sRes.json();
            if (sData.success) {
              return { packageId: pkg.id, data: sData.data };
            }
          } catch {
            return null;
          }
        });

        const stocks = await Promise.all(stockPromises);
        const map: Record<string, StockPotential> = {};
        stocks.forEach((s) => {
          if (s) map[s.packageId] = s.data;
        });
        setStockMap(map);
      }
    } catch (err) {
      console.error("Failed to load packages", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeSchool]);

  useEffect(() => {
    loadPackagesData();
  }, [loadPackagesData]);

  const filteredPackages = packages.filter((pkg) => {
    const matchesSearch =
      pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.items.some((i) => i.title.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCurriculum =
      selectedCurriculum === "all" || pkg.curriculumType === selectedCurriculum;

    return matchesSearch && matchesCurriculum;
  });

  return (
    <div className="space-y-5">
      {/* Editorial Header Section */}
      <div className="bg-white rounded-2xl p-5 border border-[#E4E6EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-md">
              Kitting & Assembly
            </span>
            <span className="text-xs text-[#65676B]">&bull; {activeSchool?.name || "Pilih Cabang"}</span>
          </div>
          <h1 className="text-xl font-bold text-[#050505] tracking-tight mt-1">
            Master Paket Buku & Perakitan Stok
          </h1>
          <p className="text-xs text-[#65676B] max-w-2xl mt-0.5">
            Kelola katalog paket terpadu (BOM), pantau stok dua tingkat (*loose stock* vs *ready bundle*), dan lakukan perakitan/pembongkaran paket fisik secara transaksional.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => loadPackagesData()}
            className="p-2.5 rounded-xl border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors"
            title="Refresh Stok"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
          <input
            type="text"
            placeholder="Cari paket atau judul buku..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] placeholder-[#65676B] focus:outline-hidden focus:border-[#1877F2]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCurriculum}
            onChange={(e) => setSelectedCurriculum(e.target.value)}
            className="px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-semibold text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
          >
            <option value="all">Semua Kurikulum</option>
            <option value="international">Internasional (Cambridge/dsb)</option>
            <option value="national">Nasional</option>
          </select>
        </div>
      </div>

      {/* Packages Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#65676B] bg-white rounded-2xl border border-[#E4E6EB]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1877F2]" />
          Memuat data paket dan ketersediaan stok...
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#E4E6EB]">
          <Boxes className="w-10 h-10 text-[#CED0D4] mx-auto mb-2" />
          <p className="text-sm font-semibold text-[#050505]">Belum ada paket buku yang cocok</p>
          <p className="text-xs text-[#65676B] mt-1">Coba sesuaikan pencarian atau filter kurikulum</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredPackages.map((pkg) => {
            const stock = stockMap[pkg.id];
            const isExpanded = expandedPackageId === pkg.id;
            const readyCount = stock?.readyBundleCount ?? 0;
            const potentialCount = stock?.maxPossibleBundles ?? 0;

            return (
              <div
                key={pkg.id}
                className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden transition-all"
              >
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Package Identity */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      pkg.curriculumType === "international"
                        ? "bg-[#E7F3FF] text-[#1877F2]"
                        : "bg-emerald-50 text-emerald-600"
                    }`}>
                      <Package className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-[#65676B] bg-[#F0F2F5] px-2 py-0.5 rounded-md">
                          {pkg.code}
                        </span>
                        <span className="text-[11px] font-semibold text-[#1877F2]">
                          Kelas {pkg.gradeLevel} &bull; {pkg.academicYear}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          pkg.curriculumType === "international"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {pkg.curriculumType}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-[#050505] mt-1">
                        {pkg.name}
                      </h3>
                      <p className="text-xs text-[#65676B] mt-0.5">
                        Terdiri dari <span className="font-semibold text-[#050505]">{pkg.totalItemsCount} buku</span> berbeda &bull; Harga: <span className="font-semibold text-[#050505]">Rp {pkg.price.toLocaleString("id-ID")}</span>
                      </p>
                    </div>
                  </div>

                  {/* Stock Metrics and Actions */}
                  <div className="flex flex-wrap items-center gap-4 lg:gap-6 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#E4E6EB]">
                    {/* Ready Bundles */}
                    <div className="bg-[#F7F8FA] px-3.5 py-2 rounded-xl text-center min-w-[110px]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#65676B] block">
                        Siap Serah (Box)
                      </span>
                      <span className={`text-base font-bold ${readyCount > 0 ? "text-emerald-600" : "text-[#65676B]"}`}>
                        {readyCount} Paket
                      </span>
                    </div>

                    {/* Assembly Potential */}
                    <div className="bg-[#F7F8FA] px-3.5 py-2 rounded-xl text-center min-w-[110px]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#65676B] block">
                        Potensi Rakit
                      </span>
                      <span className={`text-base font-bold ${potentialCount > 0 ? "text-[#1877F2]" : "text-amber-600"}`}>
                        +{potentialCount} Paket
                      </span>
                    </div>

                    {/* Operational Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setModalPkg(pkg);
                          setModalMode("bundle");
                        }}
                        disabled={potentialCount <= 0}
                        className="px-3.5 py-2 bg-[#1877F2] text-white hover:bg-[#166FE5] disabled:bg-gray-200 disabled:text-gray-400 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Rakit Paket
                      </button>

                      <button
                        onClick={() => {
                          setModalPkg(pkg);
                          setModalMode("unbundle");
                        }}
                        disabled={readyCount <= 0}
                        className="px-3 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#050505] disabled:opacity-40 rounded-xl text-xs font-semibold transition-colors"
                      >
                        Bongkar
                      </button>

                      <button
                        onClick={() => setExpandedPackageId(isExpanded ? null : pkg.id)}
                        className="p-2 rounded-xl text-[#65676B] hover:bg-[#F0F2F5] transition-colors"
                        title="Lihat Rincian Buku Satuan (BOM)"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded BOM Accordion */}
                {isExpanded && (
                  <div className="border-t border-[#E4E6EB] bg-[#F7F8FA] p-4 sm:p-5">
                    <h4 className="text-xs font-bold text-[#050505] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-[#1877F2]" />
                      Rincian Komponen Buku Satuan (Bill of Materials):
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {pkg.items.map((item) => {
                        const stockInfo = stock?.looseStockBreakdown?.find((s) => s.bookId === item.bookId);
                        const isShortage = (stockInfo?.availableLooseStock ?? 0) < item.quantity;

                        return (
                          <div
                            key={item.id}
                            className="p-3 bg-white rounded-xl border border-[#E4E6EB] shadow-2xs flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-[10px] font-mono text-[#65676B] truncate">
                                  {item.isbn}
                                </span>
                                <span className="text-[10px] font-semibold text-[#1877F2] bg-[#E7F3FF] px-1.5 py-0.5 rounded-sm">
                                  {item.quantity} eks
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-[#050505] line-clamp-2">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-[#65676B] mt-0.5">
                                {item.author}
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-[#F0F2F5] flex items-center justify-between text-[11px]">
                              <span className="text-[#65676B]">Stok Satuan (Loose):</span>
                              <span className={`font-semibold ${isShortage ? "text-amber-600" : "text-emerald-600"}`}>
                                {stockInfo?.availableLooseStock ?? 0} pcs
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bundling / Unbundling Modal */}
      {modalPkg && (
        <BundlingModal
          pkg={modalPkg}
          activeSchool={activeSchool}
          stockPotential={stockMap[modalPkg.id] || null}
          mode={modalMode}
          onClose={() => setModalPkg(null)}
          onSuccess={() => loadPackagesData()}
        />
      )}
    </div>
  );
}
