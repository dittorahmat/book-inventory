import { useEffect, useState } from "react";
import { Package, Plus, Search, ChevronDown, ChevronUp, Layers } from "lucide-react";
import type { UniformPackageRow, UniformVariantRow } from "./uniform-admin-api";
import {
  assembleUniformPackage,
  fetchUniformPackages,
  fetchUniformVariants,
} from "./uniform-admin-api";
import { CreateUniformPackageModal } from "./CreateUniformPackageModal";
import { EditUniformPackageModal } from "./EditUniformPackageModal";
import { formatRupiah } from "../../lib/transfer-pricing";
import { QuickSetStockButton } from "../inventory/QuickSetStockButton";
import { useDemoMode } from "../../lib/useDemoMode";
import { calculateUniformAssemblyPotential } from "../../lib/uniform-assembly-potential";

interface UniformAssemblySectionProps {
  defaultAcademicYear?: string;
}

export function UniformAssemblySection({ defaultAcademicYear = "2026/2027" }: UniformAssemblySectionProps) {
  const { isDemoMode } = useDemoMode();
  const [packages, setPackages] = useState<UniformPackageRow[]>([]);
  const [editingPackage, setEditingPackage] = useState<UniformPackageRow | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [variants, setVariants] = useState<UniformVariantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Search & Accordion State
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);

  const [asmQty, setAsmQty] = useState<Record<string, string>>({});
  const [asmSize, setAsmSize] = useState<Record<string, string>>({});

  const reload = async () => {
    try {
      const [pkgs, vars] = await Promise.all([
        fetchUniformPackages(),
        fetchUniformVariants(),
      ]);
      setPackages(pkgs);
      setVariants(vars);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat paket seragam.");
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(okMsg);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operasi gagal.");
    } finally {
      setBusy(false);
    }
  };

  const filteredPackages = packages.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.package.name.toLowerCase().includes(q) ||
      p.package.code.toLowerCase().includes(q) ||
      p.package.academicYear.toLowerCase().includes(q) ||
      p.bom.some((b) => b.variantName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">{notice}</div>}

      {/* Header Editorial Modul Paket Seragam */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-md">
              Rakit Seragam
            </span>
            <span className="text-xs text-[#65676B]">• TA {defaultAcademicYear}</span>
          </div>
          <h2 className="text-xl font-bold text-[#050505] tracking-tight mt-1">Master Paket & Rakit Seragam</h2>
          <p className="text-xs text-[#65676B] max-w-xl mt-0.5">
            Kelola definisi bundling paket seragam ber-BOM ({packages.length} paket terdaftar) dan rakit stok siap kirim dari persediaan gudang.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98] transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Paket Baru</span>
          </button>
        </div>
      </div>

      {/* Search Bar Toolbar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
        <input
          type="text"
          placeholder="Cari paket seragam berdasarkan nama, kode, atau komponen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] placeholder-[#65676B] focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] shadow-2xs transition-all"
        />
      </div>

      {/* Daftar Paket Seragam (Menggunakan Pola PackageCard Gudang Buku) */}
      <div className="space-y-3">
        {filteredPackages.length === 0 ? (
          <div className="bg-white text-center py-12 border border-[#E4E6EB] rounded-2xl shadow-xs">
            <Package className="w-10 h-10 text-[#CED0D4] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#050505]">
              {packages.length === 0 ? "Belum ada paket seragam yang terdefinisi" : "Tidak ada paket yang cocok dengan pencarian"}
            </p>
            <p className="text-xs text-[#65676B] mt-1 mb-4">
              {packages.length === 0
                ? "Klik tombol Tambah Paket Baru di atas untuk mulai membuat paket bundling perdana."
                : "Coba ubah kata kunci pencarian Anda."}
            </p>
            {packages.length === 0 && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Paket Sekarang</span>
              </button>
            )}
          </div>
        ) : (
          filteredPackages.map((p) => {
            const isExpanded = expandedPackageId === p.package.id;
            const currentSize = asmSize[p.package.id] ?? "";
            const potentialCount = calculateUniformAssemblyPotential(p, variants, currentSize);
            return (
              <div
                key={p.package.id}
                className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden transition-all hover:border-[#CED0D4]"
              >
                {/* Header Kartu: Identitas Paket + Metrik Stok + Aksi Edit */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1877F2] flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-[#65676B] bg-[#F0F2F5] px-2 py-0.5 rounded-md">
                          {p.package.code}
                        </span>
                        <span className="text-[11px] font-semibold text-[#1877F2]">
                          TA: {p.package.academicYear}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-[#050505] mt-1">{p.package.name}</h3>
                      <p className="text-xs text-[#65676B] mt-0.5">
                        Bundling <span className="font-semibold text-[#050505]">{p.bom.length} item</span> BOM &bull; Harga Paket:{" "}
                        <span className="font-bold text-[#1877F2]">{formatRupiah(p.package.price)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Metrik Stok Siap Kirim & Aksi Edit */}
                  <div className="flex flex-wrap items-center gap-3 lg:gap-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#E4E6EB]">
                    <div className="bg-[#F7F8FA] px-3.5 py-2 rounded-xl text-center min-w-[120px]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#65676B] block">
                        Siap Kirim
                      </span>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        <span className={`text-base font-bold ${p.readyQty > 0 ? "text-emerald-600" : "text-[#65676B]"}`}>
                          {p.readyQty} Paket
                        </span>
                        {isDemoMode && (
                          <QuickSetStockButton
                            label={p.package.name}
                            currentQuantity={p.readyQty}
                            overrideEndpoint="/api/demo/stock/uniform-package-override"
                            payload={{ packageId: p.package.id }}
                            onSuccess={reload}
                          />
                        )}
                      </div>
                    </div>

                    <div className="bg-[#F7F8FA] px-3.5 py-2 rounded-xl text-center min-w-[110px]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#65676B] block">
                        Potensi Rakit
                      </span>
                      <span className={`text-base font-bold ${potentialCount > 0 ? "text-[#1877F2]" : "text-amber-600"}`}>
                        +{potentialCount} Paket
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingPackage(p)}
                      className="px-3 py-2 border border-[#CED0D4] bg-white rounded-xl text-xs font-semibold text-[#050505] hover:bg-[#F0F2F5] active:scale-[0.98] transition-all shadow-2xs"
                    >
                      Edit Paket
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedPackageId(isExpanded ? null : p.package.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] ${
                        isExpanded
                          ? "bg-[#E7F3FF] border-[#1877F2] text-[#1877F2]"
                          : "bg-white border-[#CED0D4] text-[#050505] hover:bg-[#F0F2F5]"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{isExpanded ? "Tutup Rincian BOM" : `Lihat BOM (${p.bom.length})`}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Form Rakit Instan di Bagian Bawah Kartu */}
                <div className="px-4 py-3 bg-[#F8F9FA] border-t border-[#E4E6EB] flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-medium text-[#65676B]">
                    Rakit stok fisik siap kirim dari persediaan gudang:
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        placeholder="Jml unit"
                        value={asmQty[p.package.id] ?? ""}
                        onChange={(e) => setAsmQty({ ...asmQty, [p.package.id]: e.target.value })}
                        className="w-20 rounded-lg border border-[#CED0D4] px-2.5 py-1.5 text-xs text-center font-bold bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setAsmQty({ ...asmQty, [p.package.id]: String(potentialCount) })}
                        disabled={potentialCount <= 0}
                        className="px-2 py-1.5 text-xs font-semibold bg-[#E7F3FF] text-[#1877F2] hover:bg-[#D8ECFF] rounded-lg transition-colors shrink-0 disabled:opacity-40 disabled:hover:bg-[#E7F3FF]"
                      >
                        Maks ({potentialCount})
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Ukuran kaos (mis. M)"
                      value={asmSize[p.package.id] ?? ""}
                      onChange={(e) => setAsmSize({ ...asmSize, [p.package.id]: e.target.value })}
                      className="w-36 rounded-lg border border-[#CED0D4] px-2.5 py-1.5 text-xs bg-white"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const qty = parseInt(asmQty[p.package.id] ?? "0", 10);
                        if (qty <= 0) {
                          setError("Kuantitas rakit minimal 1 unit.");
                          return;
                        }
                        const sizeVal = (asmSize[p.package.id] ?? "").trim();
                        const overrides: Record<string, string> = {};
                        if (sizeVal) {
                          p.bom
                            .filter((b) => b.kind === "olahraga" && (!b.size || b.size === "—"))
                            .forEach((b) => {
                              overrides[b.variantId] = sizeVal;
                            });
                        }

                        run(
                          () =>
                            assembleUniformPackage(
                              p.package.id,
                              qty,
                              Object.keys(overrides).length > 0 ? overrides : undefined
                            ),
                          `Berhasil merakit ${qty} paket "${p.package.name}".`
                        );
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all shadow-xs"
                    >
                      Rakit Paket
                    </button>
                  </div>
                </div>

                {/* Akordeon: Komponen BOM & Ketersediaan Bahan */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-[#E4E6EB] bg-white space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#050505]">
                        Komponen Bill of Materials (BOM) & Ketersediaan Bahan di Gudang:
                      </span>
                      <span className="text-[11px] text-[#65676B]">
                        Total {p.bom.length} komponen pembentuk
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {p.bom.map((b) => {
                        const vRow = variants.find((v) => v.variant.id === b.variantId);
                        const stockQty =
                          b.size && b.size !== "—"
                            ? (vRow?.stock.find((s) => s.size === b.size)?.quantity ?? 0)
                            : (vRow?.stock.reduce((acc, s) => acc + s.quantity, 0) ?? 0);

                        return (
                          <div
                            key={`${b.variantId}-${b.size}`}
                            className="flex items-center justify-between p-3 rounded-xl bg-[#F8F9FA] border border-[#E4E6EB] text-xs hover:border-[#CED0D4] transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-semibold text-[#050505] truncate">{b.variantName}</p>
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[#65676B] mt-0.5">
                                <span>Tipe: {b.kind === "kain_harian" ? "Kain Harian" : "Olahraga"} &bull; Size: {b.size} &bull; Stok Bahan:</span>
                                <strong className={stockQty > 0 ? "text-emerald-700" : "text-amber-700"}>
                                  {stockQty} unit
                                </strong>
                                {isDemoMode && (
                                  <QuickSetStockButton
                                    label={`${b.variantName}${b.size && b.size !== "—" ? ` (${b.size})` : ""}`}
                                    currentQuantity={stockQty}
                                    overrideEndpoint="/api/demo/stock/uniform-override"
                                    payload={{ variantId: b.variantId, size: b.size && b.size !== "—" ? b.size : "—" }}
                                    onSuccess={reload}
                                  />
                                )}
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-[#050505] bg-white px-2.5 py-1 border border-[#E4E6EB] rounded-lg shadow-2xs shrink-0">
                              ×{b.quantity}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <CreateUniformPackageModal
        variants={variants}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={reload}
        defaultAcademicYear={defaultAcademicYear}
      />

      {editingPackage && (
        <EditUniformPackageModal
          packageRow={editingPackage}
          variants={variants}
          isOpen={true}
          onClose={() => setEditingPackage(null)}
          onSuccess={reload}
        />
      )}
    </div>
  );
}
