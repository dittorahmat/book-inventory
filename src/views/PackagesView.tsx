import { useState } from "react";
import { School } from "../types";
import { usePackagesData, type PackageRow } from "../components/packages/usePackagesData";
import { usePackagesFilter } from "../components/packages/usePackagesFilter";
import { PackageCard } from "../components/packages/PackageCard";
import { BundlingModal } from "../components/BundlingModal";
import { CreatePackageModal } from "../components/packages/CreatePackageModal";
import { PackageTransferModal } from "../components/packages/PackageTransferModal";
import { Boxes, Plus, RefreshCw, Search } from "lucide-react";
import { SearchableSingleSelect } from "../components/ui/SearchableSingleSelect";

type BookPackage = PackageRow;

interface PackagesViewProps {
  activeSchool: School | null;
}

/** Orkestrator tipis (cerminan CatalogView): data-hook + filter-hook + kartu + modal. */
export function PackagesView({ activeSchool }: PackagesViewProps) {
  const {
    packages,
    catalogBooks,
    stockMap,
    isLoading,
    loadError,
    loadPackagesData,
    createPackage,
    deletePackage,
  } = usePackagesData(activeSchool);
  const { searchQuery, setSearchQuery, selectedCurriculum, setSelectedCurriculum, filteredPackages } =
    usePackagesFilter(packages);
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);

  // Bundling / Unbundling Modal State
  const [modalPkg, setModalPkg] = useState<BookPackage | null>(null);
  const [modalMode, setModalMode] = useState<"bundle" | "unbundle">("bundle");

  // Direct Package Transfer Modal State
  const [transferPkg, setTransferPkg] = useState<BookPackage | null>(null);

  // Create Package Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="space-y-5">
      {loadError && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => loadPackagesData()}
            className="px-3 py-1.5 rounded-lg bg-white border border-red-200 font-semibold hover:bg-red-100/50 active:scale-[0.98] shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}
      {/* Editorial Header Section */}
      <div className="bg-white rounded-2xl p-5 border border-[#E4E6EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-md">
              Rakit Bundling
            </span>
            <span className="text-xs text-[#65676B]">&bull; {activeSchool?.name || "Pilih Cabang"}</span>
          </div>
          <h1 className="text-xl font-bold text-[#050505] tracking-tight mt-1">
            Master Paket Buku & Rakit Bundling
          </h1>
          <p className="text-xs text-[#65676B] max-w-2xl mt-0.5">
            Kelola katalog paket terpadu (BOM), buat paket baru, pantau stok dua tingkat (stok satuan vs bundel ready), dan lakukan rakit/bongkar paket fisik secara transaksional.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => loadPackagesData()}
            className="p-2.5 rounded-xl border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors active:scale-[0.98]"
            title="Refresh Stok"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold text-xs transition-colors shadow-2xs flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Buat Paket Baru</span>
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

        <div className="w-full sm:w-64">
          <SearchableSingleSelect
            options={[
              { value: "all", label: "Semua Kurikulum" },
              { value: "international", label: "Internasional (Cambridge/dsb)" },
              { value: "national", label: "Nasional" },
            ]}
            value={selectedCurriculum}
            onChange={setSelectedCurriculum}
            placeholder="Filter kurikulum..."
          />
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
          <p className="text-xs text-[#65676B] mt-1 mb-3">
            Klik tombol <strong>+ Buat Paket Baru</strong> di atas untuk membuat paket bundling perdana.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Paket Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredPackages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              stock={stockMap[pkg.id]}
              catalogBooks={catalogBooks}
              isExpanded={expandedPackageId === pkg.id}
              onToggleExpand={() => setExpandedPackageId(expandedPackageId === pkg.id ? null : pkg.id)}
              onOpenBundling={(mode) => {
                setModalPkg(pkg);
                setModalMode(mode);
              }}
              onOpenTransfer={() => setTransferPkg(pkg)}
              deletePackage={deletePackage}
            />
          ))}
        </div>
      )}

      {/* CREATE PACKAGE MODAL */}
      {isCreateModalOpen && (
        <CreatePackageModal
          catalogBooks={catalogBooks}
          createPackage={createPackage}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={() => loadPackagesData()}
        />
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

      {/* Direct Package Transfer Modal */}
      {transferPkg && (
        <PackageTransferModal
          packageId={transferPkg.id}
          packageCode={transferPkg.code}
          packageName={transferPkg.name}
          packagePrice={transferPkg.price}
          activeSchool={activeSchool}
          onClose={() => setTransferPkg(null)}
          onSuccess={() => loadPackagesData()}
        />
      )}
    </div>
  );
}
