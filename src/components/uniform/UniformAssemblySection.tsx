import { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
import type { UniformPackageRow, UniformVariantRow } from "./uniform-admin-api";
import {
  assembleUniformPackage,
  fetchUniformPackages,
  fetchUniformVariants,
} from "./uniform-admin-api";
import { CreateUniformPackageModal } from "./CreateUniformPackageModal";
import { EditUniformPackageModal } from "./EditUniformPackageModal";
import { formatRupiah } from "../../lib/transfer-pricing";

interface UniformAssemblySectionProps {
  defaultAcademicYear?: string;
}

export function UniformAssemblySection({ defaultAcademicYear = "2026/2027" }: UniformAssemblySectionProps) {
  const [packages, setPackages] = useState<UniformPackageRow[]>([]);
  const [editingPackage, setEditingPackage] = useState<UniformPackageRow | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [variants, setVariants] = useState<UniformVariantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">{notice}</div>}

      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-5 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E4E6EB]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-md">
                Rakit Seragam
              </span>
              <span className="text-xs text-[#65676B]">• TA {defaultAcademicYear}</span>
            </div>
            <h3 className="text-base font-bold text-[#050505] tracking-tight mt-1">Master Paket & Rakit Seragam</h3>
            <p className="text-xs text-[#65676B] max-w-xl">
              Kelola definisi bundling paket seragam ber-BOM dan rakit stok siap kirim dari persediaan gudang.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98] transition-all shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Paket Baru</span>
          </button>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold text-[#050505]">Daftar Paket & Aksi Rakit</h4>
          {packages.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-[#CED0D4] rounded-2xl">
              <Package className="w-8 h-8 text-[#65676B] mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-[#050505]">Belum ada paket seragam yang terdefinisi</p>
              <p className="text-[11px] text-[#65676B] mt-0.5">Klik tombol Tambah Paket Baru di atas untuk mulai membuat paket bundling.</p>
            </div>
          ) : (
            packages.map((p) => (
              <div
                key={p.package.id}
                className="rounded-xl border border-[#E4E6EB] p-4 space-y-3 bg-white hover:border-[#1877F2]/40 transition-colors shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#E4E6EB]">
                  <div>
                    <h5 className="text-xs font-bold text-[#050505]">{p.package.name}</h5>
                    <p className="text-[11px] text-[#65676B]">
                      Kode: <span className="font-mono font-semibold">{p.package.code}</span> · Th. Ajaran: {p.package.academicYear} · Harga:{" "}
                      <strong className="text-[#1877F2]">{formatRupiah(p.package.price)}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E7F3FF] text-[#1877F2]">
                      Stok Rakit Siap Kirim: {p.readyQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingPackage(p)}
                      className="px-3 py-1.5 border border-[#CED0D4] rounded-lg text-xs font-semibold text-[#050505] hover:bg-[#F0F2F5] active:scale-[0.98] transition-all"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-[#65676B]">Komponen BOM & Ketersediaan Bahan:</span>
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
                          className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F9FA] border border-[#E4E6EB] text-xs"
                        >
                          <div>
                            <p className="font-semibold text-[#050505]">{b.variantName}</p>
                            <p className="text-[10px] text-[#65676B]">
                              Tipe: {b.kind === "kain_harian" ? "Kain Harian" : "Olahraga"} · Size: {b.size} · Stok Bahan:{" "}
                              <strong className={stockQty > 0 ? "text-emerald-700" : "text-amber-700"}>
                                {stockQty} unit
                              </strong>
                            </p>
                          </div>
                          <span className="text-[11px] font-bold text-[#050505] bg-white px-2 py-0.5 border border-[#E4E6EB] rounded-md">
                            ×{b.quantity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E4E6EB] flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Jml rakit"
                    value={asmQty[p.package.id] ?? ""}
                    onChange={(e) => setAsmQty({ ...asmQty, [p.package.id]: e.target.value })}
                    className="w-24 rounded-lg border border-[#CED0D4] px-2.5 py-1 text-xs text-center font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Ukuran (opsional)"
                    value={asmSize[p.package.id] ?? ""}
                    onChange={(e) => setAsmSize({ ...asmSize, [p.package.id]: e.target.value })}
                    className="w-32 rounded-lg border border-[#CED0D4] px-2.5 py-1 text-xs"
                  />
                  <button
                    type="button"
                    disabled={busy || !(parseInt(asmQty[p.package.id] ?? "0", 10) > 0)}
                    onClick={() =>
                      run(
                        () =>
                          assembleUniformPackage(
                            p.package.id,
                            parseInt(asmQty[p.package.id] ?? "0", 10)
                          ),
                        `Berhasil merakit ${asmQty[p.package.id]} paket "${p.package.name}".`
                      )
                    }
                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition-all"
                  >
                    Rakit Paket
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
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
