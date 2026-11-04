import { useEffect, useState } from "react";
import type { UniformPackageRow, UniformVariantRow } from "./uniform-admin-api";
import {
  assembleUniformPackage,
  createUniformPackage,
  fetchUniformPackages,
  fetchUniformVariants,
} from "./uniform-admin-api";

interface UniformAssemblySectionProps {
  defaultAcademicYear?: string;
}

export function UniformAssemblySection({ defaultAcademicYear = "2026/2027" }: UniformAssemblySectionProps) {
  const [packages, setPackages] = useState<UniformPackageRow[]>([]);
  const [variants, setVariants] = useState<UniformVariantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [pCode, setPCode] = useState("");
  const [pName, setPName] = useState("");
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [pItems, setPItems] = useState<Array<{ variantId: string; quantity: number }>>([]);
  const [asmQty, setAsmQty] = useState<Record<string, string>>({});
  const [asmSize, setAsmSize] = useState<Record<string, string>>({});

  const inputCls = "w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white";
  const labelCls = "block text-xs font-semibold text-[#050505] mb-1";

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

      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#050505]">Tambah Paket & Rakit Paket Seragam</h3>
          <p className="text-xs text-[#65676B]">
            Buat bundling paket seragam ber-BOM dan rakit stok siap kirim dari bahan baku gudang.
          </p>
        </div>

        <div className="rounded-xl border border-[#E4E6EB] bg-[#F8F9FA] p-3 space-y-3">
          <h4 className="text-xs font-bold text-[#050505]">Buat Definisi Paket Seragam Baru</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Kode Paket (Unik)</label>
              <input
                placeholder="Contoh: PKG-UNIF-SD-PUTRA-2026"
                value={pCode}
                onChange={(e) => setPCode(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Nama Paket Seragam</label>
              <input
                placeholder="Contoh: Paket Seragam Lengkap SD Putra (Kain + Olahraga)"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Tahun Ajaran</label>
              <input
                placeholder="2026/2027"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Pilih Komponen Penyusun (BOM):</label>
            <div className="flex flex-wrap gap-2">
              {variants.map(({ variant: v }) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() =>
                    setPItems((prev) =>
                      prev.some((item) => item.variantId === v.id)
                        ? prev.filter((item) => item.variantId !== v.id)
                        : [...prev, { variantId: v.id, quantity: 1 }]
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    pItems.some((item) => item.variantId === v.id)
                      ? "bg-[#1877F2] text-white border-[#1877F2]"
                      : "bg-white text-[#050505] border-[#CED0D4] hover:bg-[#F0F2F5]"
                  }`}
                >
                  {pItems.some((item) => item.variantId === v.id) ? "✓ " : "+ "}
                  {v.name} ({v.code})
                </button>
              ))}
            </div>
          </div>

          {pItems.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#E4E6EB]">
              <span className="text-xs font-bold text-[#050505]">Atur Kuantitas per Paket:</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {pItems.map((item) => {
                  const v = variants.find((x) => x.variant.id === item.variantId);
                  return (
                    <div
                      key={item.variantId}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-[#E4E6EB]"
                    >
                      <span className="text-xs font-semibold text-[#050505] truncate">
                        {v?.variant.name ?? item.variantId}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            setPItems((prev) =>
                              prev.map((pi) => (pi.variantId === item.variantId ? { ...pi, quantity: val } : pi))
                            );
                          }}
                          className="w-16 rounded-lg border border-[#CED0D4] px-2 py-1 text-xs text-center"
                        />
                        <span className="text-xs text-[#65676B]">unit</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={busy || !pCode.trim() || !pName.trim() || !academicYear.trim() || pItems.length === 0}
            onClick={() =>
              run(
                () =>
                  createUniformPackage({
                    code: pCode.trim(),
                    name: pName.trim(),
                    academicYear: academicYear.trim(),
                    items: pItems,
                  }).then(() => {
                    setPCode("");
                    setPName("");
                    setPItems([]);
                  }),
                "Definisi paket seragam baru berhasil dibuat."
              )
            }
            className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98] disabled:opacity-50 transition-colors"
          >
            Simpan Definisi Paket
          </button>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold text-[#050505]">Daftar Paket & Aksi Rakit</h4>
          {packages.length === 0 ? (
            <p className="text-xs text-[#65676B] py-2">Belum ada paket seragam yang terdefinisi.</p>
          ) : (
            packages.map((p) => (
              <div
                key={p.package.id}
                className="rounded-xl border border-[#E4E6EB] p-3.5 space-y-3 bg-white hover:border-[#1877F2]/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-[#E4E6EB]">
                  <div>
                    <h5 className="text-xs font-bold text-[#050505]">{p.package.name}</h5>
                    <p className="text-[11px] text-[#65676B]">
                      Kode: <span className="font-mono">{p.package.code}</span> · Th. Ajaran: {p.package.academicYear}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E7F3FF] text-[#1877F2]">
                      Stok Rakit Siap Kirim: {p.readyQty}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
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
                          className="flex items-center justify-between p-2 rounded-lg bg-[#F8F9FA] border border-[#E4E6EB] text-xs"
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
                          <span className="font-bold text-[#1877F2]">{b.quantity} unit / paket</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-semibold text-[#050505]">Rakit Paket:</span>
                  <input
                    value={asmQty[p.package.id] ?? ""}
                    inputMode="numeric"
                    placeholder="Kuantitas"
                    onChange={(e) => setAsmQty((s) => ({ ...s, [p.package.id]: e.target.value }))}
                    className="w-24 rounded-xl border border-[#CED0D4] px-2.5 py-1.5 text-xs bg-white"
                  />
                  {p.bom.some((b) => b.kind === "olahraga" && b.size === "—") && (
                    <input
                      value={asmSize[p.package.id] ?? ""}
                      placeholder="Size kaos (mis. M)"
                      onChange={(e) => setAsmSize((s) => ({ ...s, [p.package.id]: e.target.value }))}
                      className="w-36 rounded-xl border border-[#CED0D4] px-2.5 py-1.5 text-xs bg-white"
                    />
                  )}
                  <button
                    type="button"
                    disabled={busy || !asmQty[p.package.id]}
                    onClick={() => {
                      const sizeVal = (asmSize[p.package.id] ?? "").trim();
                      const overrides: Record<string, string> = {};
                      if (sizeVal) {
                        p.bom
                          .filter((b) => b.kind === "olahraga" && b.size === "—")
                          .forEach((b) => {
                            overrides[b.variantId] = sizeVal;
                          });
                      }
                      run(
                        () =>
                          assembleUniformPackage(
                            p.package.id,
                            Number(asmQty[p.package.id]) || 0,
                            Object.keys(overrides).length > 0 ? overrides : undefined
                          ),
                        "Paket berhasil dirakit ke stok siap kirim."
                      );
                    }}
                    className="px-4 py-1.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98] disabled:opacity-50 transition-colors"
                  >
                    Konfirmasi Rakit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
