import { useState } from "react";
import type { UniformPackageRow, UniformVariantRow } from "./uniform-admin-api";
import { assembleUniformPackage, createUniformPackage } from "./uniform-admin-api";

interface UniformAssemblySubSectionProps {
  packages: UniformPackageRow[];
  variants: UniformVariantRow[];
  vYear: string;
  busy: boolean;
  onRefresh: () => void;
  run: (action: () => Promise<unknown>, successMsg: string) => Promise<void>;
}

export function UniformAssemblySubSection({
  packages,
  variants,
  vYear,
  busy,
  run,
}: UniformAssemblySubSectionProps) {
  const [pCode, setPCode] = useState("");
  const [pName, setPName] = useState("");
  const [pItems, setPItems] = useState<Array<{ variantId: string; quantity: number }>>([]);
  const [asmQty, setAsmQty] = useState<Record<string, string>>({});
  const [asmSize, setAsmSize] = useState<Record<string, string>>({});

  const inputCls = "w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white";
  const labelCls = "block text-xs font-semibold text-[#050505] mb-1";

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-[#050505]">Tambah Paket & Rakit Paket Seragam</h3>
        <p className="text-xs text-[#65676B]">
          Buat bundling paket seragam ber-BOM dan rakit stok siap kirim dari bahan baku gudang.
        </p>
      </div>

      <div className="rounded-xl border border-[#E4E6EB] bg-[#F8F9FA] p-3 space-y-3">
        <h4 className="text-xs font-bold text-[#050505]">Buat Definisi Paket Seragam Baru</h4>
        <div className="grid gap-3 sm:grid-cols-2">
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
                    prev.some((i) => i.variantId === v.id)
                      ? prev
                      : [...prev, { variantId: v.id, quantity: 1 }]
                  )
                }
                className="px-3 py-1.5 rounded-full border border-[#CED0D4] bg-white text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98] transition-colors"
              >
                + {v.name} ({v.code})
              </button>
            ))}
          </div>
        </div>

        {pItems.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-semibold text-[#050505]">Komponen Terpilih:</span>
            <div className="flex flex-wrap gap-1.5">
              {pItems.map((item, idx) => {
                const found = variants.find((x) => x.variant.id === item.variantId)?.variant;
                return (
                  <span
                    key={item.variantId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#CED0D4] rounded-lg text-xs"
                  >
                    <strong className="text-[#1877F2]">{found?.name ?? item.variantId}</strong>
                    <span className="text-[#65676B]">x {item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setPItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-[#65676B] hover:text-red-600 font-bold ml-1"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={busy || !pCode.trim() || !pName.trim() || pItems.length === 0}
          onClick={() =>
            run(
              () =>
                createUniformPackage({
                  code: pCode.trim(),
                  name: pName.trim(),
                  academicYear: vYear.trim(),
                  items: pItems,
                }).then(() => {
                  setPCode("");
                  setPName("");
                  setPItems([]);
                }),
              "Paket seragam berhasil disimpan."
            )
          }
          className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98] transition-colors"
        >
          Simpan Paket Seragam
        </button>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-[#050505]">Daftar Paket & Rincian Isi Paket (BOM)</h4>
        <div className="divide-y divide-[#E4E6EB] rounded-xl border border-[#E4E6EB]">
          {packages.length === 0 ? (
            <p className="p-4 text-center text-xs text-[#65676B]">Belum ada paket seragam terdaftar.</p>
          ) : (
            packages.map((p) => (
              <div key={p.package.id} className="p-4 text-xs space-y-3 hover:bg-[#F8F9FA]/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-sm text-[#050505]">{p.package.name}</span>
                    <div className="text-[11px] text-[#65676B]">
                      Kode: <span className="font-mono font-semibold">{p.package.code}</span> · Siap Kirim:{" "}
                      <strong className="text-emerald-700">{p.readyQty} unit</strong>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#F0F2F5] rounded-xl space-y-1.5 border border-[#E4E6EB]">
                  <span className="text-[11px] font-bold text-[#050505] block">
                    Rincian Isi Paket (BOM Komponen):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {p.bom.map((b) => {
                      const vObj = variants.find((x) => x.variant.id === b.variantId);
                      const stockQty =
                        b.size && b.size !== "—"
                          ? (vObj?.stock.find((s) => s.size === b.size)?.quantity ?? 0)
                          : (vObj?.stock.reduce((acc, s) => acc + s.quantity, 0) ?? 0);

                      return (
                        <div
                          key={b.variantId}
                          className="bg-white p-2 rounded-lg border border-[#E4E6EB] text-[11px] flex justify-between items-center"
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
