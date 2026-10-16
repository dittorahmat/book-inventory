import { useEffect, useState } from "react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { getJson } from "../../lib/api";
import { formatRupiah } from "../../lib/transfer-pricing";
import {
  fetchUniformVariants, createUniformVariant,
  fetchUniformPackages, createUniformPackage, assembleUniformPackage,
  fetchUniformPos, createUniformPo, receiveUniformPo,
  type UniformVariantRow, type UniformPackageRow,
} from "./uniform-admin-api";

const inputCls = "w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white";
const labelCls = "block text-xs font-semibold text-[#050505] mb-1";

export function UniformCatalogSection() {
  const [variants, setVariants] = useState<UniformVariantRow[]>([]);
  const [packages, setPackages] = useState<UniformPackageRow[]>([]);
  const [pos, setPos] = useState<Array<{ id: string; poNumber: string; status: string; totalAmount: number }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [vCode, setVCode] = useState("");
  const [vName, setVName] = useState("");
  const [vKind, setVKind] = useState("kain_harian");
  const [vGender, setVGender] = useState("male");
  const [vJenjang, setVJenjang] = useState("sd");
  const [vYear, setVYear] = useState("2026/2027");
  const [vPrice, setVPrice] = useState("0");
  const [vSizes, setVSizes] = useState("");
  const [vChart, setVChart] = useState("");

  const [pCode, setPCode] = useState("");
  const [pName, setPName] = useState("");
  const [pItems, setPItems] = useState<Array<{ variantId: string; quantity: number }>>([]);
  const [poSupplier, setPoSupplier] = useState("");
  const [poLines, setPoLines] = useState<Array<{ variantId: string; size: string; qty: string; price: string }>>([]);
  const [asmQty, setAsmQty] = useState<Record<string, string>>({});
  const [asmSize, setAsmSize] = useState<Record<string, string>>({});

  const reload = async () => {
    try {
      const [v, p, o, s] = await Promise.all([
        fetchUniformVariants(), fetchUniformPackages(), fetchUniformPos(),
        getJson<Array<{ id: string; name: string }>>("/api/procurement/suppliers", "Gagal memuat supplier."),
      ]);
      setVariants(v);
      setPackages(p);
      setPos(o);
      setSuppliers(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data seragam.");
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

      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 space-y-3">
        <h3 className="text-sm font-bold">Tambah Varian</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className={labelCls}>Kode</label><input value={vCode} onChange={(e) => setVCode(e.target.value)} className={inputCls} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Nama</label><input value={vName} onChange={(e) => setVName(e.target.value)} className={inputCls} /></div>
          <div><SearchableSingleSelect
            label="Jenis"
            options={[
              { value: "kain_harian", label: "Kain harian" },
              { value: "olahraga", label: "Olahraga jadi" },
            ]}
            value={vKind}
            onChange={setVKind}
            placeholder="Pilih jenis..."
          />
          </div>
          <div><SearchableSingleSelect
            label="Gender"
            options={[
              { value: "male", label: "Laki-laki" },
              { value: "female", label: "Perempuan" },
            ]}
            value={vGender}
            onChange={setVGender}
            placeholder="Pilih gender..."
          />
          </div>
          <div><SearchableSingleSelect
            label="Jenjang"
            options={[
              { value: "tk", label: "TK" },
              { value: "sd", label: "SD" },
              { value: "smp", label: "SMP" },
              { value: "sma", label: "SMA" },
            ]}
            value={vJenjang}
            onChange={setVJenjang}
            placeholder="Pilih jenjang..."
          />
          </div>
          <div><label className={labelCls}>Tahun ajaran</label><input value={vYear} onChange={(e) => setVYear(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Harga (Rp)</label><input value={vPrice} inputMode="numeric" onChange={(e) => setVPrice(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Size chart URL</label><input value={vChart} onChange={(e) => setVChart(e.target.value)} className={inputCls} /></div>
          {vKind === "olahraga" && (
            <div className="sm:col-span-3"><label className={labelCls}>Size (koma, mis. S,M,L)</label><input value={vSizes} onChange={(e) => setVSizes(e.target.value)} className={inputCls} /></div>
          )}
        </div>
        <button
          type="button" disabled={busy}
          onClick={() => run(() => createUniformVariant({
            code: vCode.trim(), name: vName.trim(), kind: vKind, gender: vGender, jenjang: vJenjang,
            academicYear: vYear.trim(), price: Number(vPrice) || 0,
            sizeChartUrl: vChart.trim() || undefined,
            sizes: vKind === "olahraga" ? vSizes.split(",").map((s) => s.trim()).filter(Boolean) : [],
          }), "Varian tersimpan.")}
          className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
        >
          Simpan Varian
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E6EB] divide-y divide-[#E4E6EB]">
        {variants.length === 0 && <div className="px-4 py-6 text-center text-xs text-[#65676B]">Belum ada varian.</div>}
        {variants.map(({ variant: v, sizes, stock }) => (
          <div key={v.id} className="px-4 py-3 text-xs">
            <div className="text-sm font-semibold">{v.name} <span className="font-normal text-[#65676B]">· {v.code}</span></div>
            <div className="text-[#65676B]">{v.kind === "kain_harian" ? "Kain" : "Olahraga"} · {v.gender === "male" ? "L" : "P"} · {v.jenjang.toUpperCase()} · {formatRupiah(v.price)}</div>
            <div className="text-[#65676B]">{sizes.length > 0 ? `Size: ${sizes.join(", ")}` : "Tanpa ukuran"} · Stok: {stock.map((s) => `${s.size}=${s.quantity}`).join(", ") || "0"}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 space-y-3">
        <h3 className="text-sm font-bold">Tambah Paket + Rakit</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={labelCls}>Kode paket</label><input value={pCode} onChange={(e) => setPCode(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Nama paket</label><input value={pName} onChange={(e) => setPName(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {variants.map(({ variant: v }) => (
            <button
              key={v.id} type="button"
              onClick={() => setPItems((prev) => (prev.some((i) => i.variantId === v.id) ? prev : [...prev, { variantId: v.id, quantity: 1 }]))}
              className="px-3 py-1.5 rounded-full border border-[#CED0D4] text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]"
            >
              + {v.code}
            </button>
          ))}
        </div>
        {pItems.length > 0 && (
          <div className="text-xs text-[#65676B]">{pItems.map((i) => `${variants.find((x) => x.variant.id === i.variantId)?.variant.code}×${i.quantity}`).join(" + ")}</div>
        )}
        <button
          type="button" disabled={busy || pItems.length === 0}
          onClick={() => run(() => createUniformPackage({ code: pCode.trim(), name: pName.trim(), academicYear: vYear.trim(), items: pItems }).then(() => setPItems([])), "Paket tersimpan.")}
          className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
        >
          Simpan Paket
        </button>
        <div className="divide-y divide-[#E4E6EB] rounded-xl border border-[#E4E6EB]">
          {packages.map((p) => (
            <div key={p.package.id} className="px-4 py-3 text-xs space-y-2">
              <div className="text-sm font-semibold">{p.package.name} <span className="font-normal text-[#65676B]">· siap {p.readyQty}</span></div>
              <div className="flex flex-wrap items-center gap-2">
                <input value={asmQty[p.package.id] ?? ""} inputMode="numeric" placeholder="Qty" onChange={(e) => setAsmQty((s) => ({ ...s, [p.package.id]: e.target.value }))} className="w-20 rounded-xl border border-[#CED0D4] px-2 py-1.5 text-sm" />
                {p.bom.some((b) => b.kind === "olahraga" && b.size === "—") && (
                  <input value={asmSize[p.package.id] ?? ""} placeholder="Size (mis. M)" onChange={(e) => setAsmSize((s) => ({ ...s, [p.package.id]: e.target.value }))} className="w-28 rounded-xl border border-[#CED0D4] px-2 py-1.5 text-sm" />
                )}
                <button
                  type="button" disabled={busy}
                  onClick={() => {
                    const sizeVal = (asmSize[p.package.id] ?? "").trim();
                    const overrides: Record<string, string> = {};
                    if (sizeVal) p.bom.filter((b) => b.kind === "olahraga" && b.size === "—").forEach((b) => { overrides[b.variantId] = sizeVal; });
                    run(() => assembleUniformPackage(p.package.id, Number(asmQty[p.package.id]) || 0, Object.keys(overrides).length > 0 ? overrides : undefined), "Paket dirakit.");
                  }}
                  className="px-4 py-1.5 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
                >
                  Rakit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 space-y-3">
        <h3 className="text-sm font-bold">PO ke Konveksi</h3>
        <div>
          <SearchableSingleSelect
            label="Supplier"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            value={poSupplier}
            onChange={setPoSupplier}
            placeholder="— Pilih supplier —"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {variants.map(({ variant: v }) => (
            <button
              key={v.id} type="button"
              onClick={() => setPoLines((prev) => (prev.some((l) => l.variantId === v.id) ? prev : [...prev, { variantId: v.id, size: "", qty: "1", price: String(v.price) }]))}
              className="px-3 py-1.5 rounded-full border border-[#CED0D4] text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]"
            >
              + {v.code}
            </button>
          ))}
        </div>
        {poLines.map((l, idx) => (
          <div key={l.variantId} className="grid grid-cols-4 gap-2 items-center text-xs">
            <span className="font-semibold truncate">{variants.find((x) => x.variant.id === l.variantId)?.variant.code}</span>
            <input value={l.size} placeholder="Size" onChange={(e) => setPoLines((prev) => prev.map((x, i) => (i === idx ? { ...x, size: e.target.value } : x)))} className={inputCls} />
            <input value={l.qty} inputMode="numeric" placeholder="Qty" onChange={(e) => setPoLines((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))} className={inputCls} />
            <input value={l.price} inputMode="numeric" placeholder="Harga" onChange={(e) => setPoLines((prev) => prev.map((x, i) => (i === idx ? { ...x, price: e.target.value } : x)))} className={inputCls} />
          </div>
        ))}
        <button
          type="button" disabled={busy || !poSupplier || poLines.length === 0}
          onClick={() => run(() => createUniformPo({
            supplierId: poSupplier,
            lines: poLines.map((l) => ({ variantId: l.variantId, size: l.size.trim() || undefined, quantityOrdered: Number(l.qty) || 0, unitPrice: Number(l.price) || 0 })),
          }).then(() => setPoLines([])), "PO tersimpan.")}
          className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
        >
          Buat PO
        </button>
        <div className="divide-y divide-[#E4E6EB] rounded-xl border border-[#E4E6EB]">
          {pos.map((p) => (
            <div key={p.id} className="px-4 py-3 text-xs flex items-center justify-between gap-2">
              <div><span className="font-semibold">{p.poNumber}</span> <span className="text-[#65676B]">· {p.status} · {formatRupiah(p.totalAmount)}</span></div>
              {(p.status === "draft" || p.status === "partially_received") && (
                <button
                  type="button" disabled={busy}
                  onClick={() => {
                    const lines = poLines.filter((l) => l.qty).map((l) => ({ variantId: l.variantId, size: l.size.trim() || undefined, quantity: Number(l.qty) || 0 }));
                    if (lines.length === 0) {
                      setError("Isi baris penerimaan (tambah varian di atas lalu Terima).");
                      return;
                    }
                    run(() => receiveUniformPo(p.id, lines), "Penerimaan tercatat.");
                  }}
                  className="px-4 py-1.5 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
                >
                  Terima
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
