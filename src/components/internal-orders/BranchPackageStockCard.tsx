import { useState } from "react";
import { Package, ChevronDown, ChevronUp, RefreshCw, Search } from "lucide-react";
import type { School } from "../../types";
import { usePackagesData } from "../packages/usePackagesData";
import { curriculumLabel } from "../../lib/curriculum";

interface BranchPackageStockCardProps {
  school: School | null;
}

/**
 * Panel Ringkasan Stok Paket Buku Cabang (Read-Only).
 * Menampilkan ketersediaan stok siap serah untuk masing-masing paket buku di cabang
 * tanpa tombol manipulasi fisik (rakit/bongkar).
 */
export function BranchPackageStockCard({ school }: BranchPackageStockCardProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { packages, stockMap, isLoading, loadError, loadPackagesData } = usePackagesData(school);

  if (!school) return null;

  const filtered = packages.filter((pkg) => {
    const q = search.toLowerCase();
    return (
      pkg.name.toLowerCase().includes(q) ||
      pkg.code.toLowerCase().includes(q) ||
      pkg.gradeLevel.toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-2xl border border-[#E4E6EB] bg-white p-5 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#F0F2F5]">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-[#1877F2]">
              Stok Cabang
            </span>
            <span className="text-xs text-[#65676B]">&bull; {school.name}</span>
          </div>
          <h2 className="mt-1 text-base font-bold text-[#050505]">
            Ketersediaan Stok Paket Buku di Cabang
          </h2>
          <p className="text-xs text-[#65676B]">
            Pantau jumlah bundel paket buku siap serah yang telah diterima dan tersedia di cabang ini.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#65676B]" />
            <input
              type="text"
              placeholder="Cari nama / kode / kelas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#CED0D4] bg-[#F0F2F5] py-1.5 pl-8 pr-3 text-xs text-[#050505] placeholder-[#65676B] focus:border-[#1877F2] focus:bg-white focus:outline-hidden"
            />
          </div>
          <button
            type="button"
            onClick={() => loadPackagesData()}
            title="Muat ulang stok paket cabang"
            className="rounded-xl border border-[#CED0D4] p-2 text-[#65676B] transition-colors hover:bg-[#F0F2F5] active:scale-[0.98]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => loadPackagesData()}
            className="font-semibold underline hover:text-red-900"
          >
            Coba lagi
          </button>
        </div>
      )}

      {isLoading && (
        <div className="py-8 text-center text-xs text-[#65676B]">
          <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-[#1877F2]" />
          <span>Memuat data stok paket cabang...</span>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="py-8 text-center text-xs text-[#65676B]">
          {search ? "Tidak ada paket buku yang sesuai dengan pencarian." : "Belum ada paket buku terdaftar."}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => {
            const stock = stockMap[pkg.id];
            const readyCount = stock?.readyBundleCount ?? 0;
            const isExpanded = expandedId === pkg.id;

            return (
              <div
                key={pkg.id}
                className="flex flex-col justify-between rounded-xl border border-[#E4E6EB] bg-[#F7F8FA]/60 p-4 transition-all hover:bg-white hover:shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1877F2]">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="block font-mono text-[11px] font-bold text-[#65676B]">
                          {pkg.code}
                        </span>
                        <h3 className="truncate text-xs font-bold text-[#050505]" title={pkg.name}>
                          {pkg.name}
                        </h3>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        pkg.curriculumType === "international"
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {curriculumLabel(pkg.curriculumType)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#65676B]">
                    <span>Kelas {pkg.gradeLevel}</span>
                    <span>&bull;</span>
                    <span>{pkg.academicYear}</span>
                    <span>&bull;</span>
                    <span>{pkg.items?.length ?? 0} judul</span>
                  </div>
                </div>

                <div className="mt-3 border-t border-[#E4E6EB] pt-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-[#65676B]">
                        Stok Siap Serah
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          readyCount > 0 ? "text-emerald-600" : "text-[#65676B]"
                        }`}
                      >
                        {readyCount} Paket
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                      className="flex items-center gap-1 rounded-lg border border-[#CED0D4] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#050505] transition-colors hover:bg-[#F0F2F5] active:scale-[0.98]"
                    >
                      <span>{isExpanded ? "Tutup" : "Rincian"}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-2.5 space-y-1.5 rounded-lg border border-[#E4E6EB] bg-white p-2.5 text-[11px]">
                      <span className="font-semibold text-[#050505]">Komponen Isi Paket:</span>
                      <ul className="space-y-1 text-[#65676B]">
                        {pkg.items?.map((item) => (
                          <li key={item.id} className="flex justify-between gap-2">
                            <span className="truncate">{item.title}</span>
                            <span className="shrink-0 font-medium text-[#050505]">
                              {item.quantity} eks
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
