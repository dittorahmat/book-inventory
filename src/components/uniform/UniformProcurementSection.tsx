import { useEffect, useState } from "react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { getJson } from "../../lib/api";
import { formatRupiah } from "../../lib/transfer-pricing";
import {
  fetchUniformVariants,
  fetchUniformPos,
  createUniformPo,
  receiveUniformPo,
  type UniformVariantRow,
} from "./uniform-admin-api";

const inputCls = "w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white";

export function UniformProcurementSection() {
  const [variants, setVariants] = useState<UniformVariantRow[]>([]);
  const [pos, setPos] = useState<Array<{ id: string; poNumber: string; status: string; totalAmount: number }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [poSupplier, setPoSupplier] = useState("");
  const [poLines, setPoLines] = useState<Array<{ variantId: string; size: string; qty: string; price: string }>>([]);

  const reload = async () => {
    try {
      const [v, o, s] = await Promise.all([
        fetchUniformVariants(),
        fetchUniformPos(),
        getJson<Array<{ id: string; name: string }>>("/api/procurement/suppliers", "Gagal memuat supplier."),
      ]);
      setVariants(Array.isArray(v) ? v : []);
      setPos(Array.isArray(o) ? o : []);
      setSuppliers(Array.isArray(s) ? s : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data PO konveksi.");
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
        <div>
          <h3 className="text-sm font-bold text-[#050505]">PO ke Konveksi</h3>
          <p className="text-xs text-[#65676B]">Buat pesanan produksi bahan/kain atau seragam jadi ke mitra konveksi supplier.</p>
        </div>
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
              key={v.id}
              type="button"
              onClick={() =>
                setPoLines((prev) =>
                  prev.some((l) => l.variantId === v.id)
                    ? prev
                    : [...prev, { variantId: v.id, size: "", qty: "1", price: String(v.price) }]
                )
              }
              className="px-3 py-1.5 rounded-full border border-[#CED0D4] text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98]"
            >
              + {v.name} ({v.code})
            </button>
          ))}
        </div>
        {poLines.map((l, idx) => (
          <div key={l.variantId} className="grid grid-cols-4 gap-2 items-center text-xs">
            <span className="font-semibold truncate">{variants.find((x) => x.variant.id === l.variantId)?.variant.code}</span>
            <input
              value={l.size}
              placeholder="Size"
              onChange={(e) => setPoLines((prev) => prev.map((x, i) => (i === idx ? { ...x, size: e.target.value } : x)))}
              className={inputCls}
            />
            <input
              value={l.qty}
              inputMode="numeric"
              placeholder="Qty"
              onChange={(e) => setPoLines((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))}
              className={inputCls}
            />
            <input
              value={l.price}
              inputMode="numeric"
              placeholder="Harga"
              onChange={(e) => setPoLines((prev) => prev.map((x, i) => (i === idx ? { ...x, price: e.target.value } : x)))}
              className={inputCls}
            />
          </div>
        ))}
        <button
          type="button"
          disabled={busy || !poSupplier || poLines.length === 0}
          onClick={() =>
            run(
              () =>
                createUniformPo({
                  supplierId: poSupplier,
                  lines: poLines.map((l) => ({
                    variantId: l.variantId,
                    size: l.size.trim() || undefined,
                    quantityOrdered: Number(l.qty) || 0,
                    unitPrice: Number(l.price) || 0,
                  })),
                }).then(() => setPoLines([])),
              "PO tersimpan."
            )
          }
          className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
        >
          Buat PO
        </button>
        <div className="divide-y divide-[#E4E6EB] rounded-xl border border-[#E4E6EB]">
          {pos.map((p) => (
            <div key={p.id} className="px-4 py-3 text-xs flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold">{p.poNumber}</span>{" "}
                <span className="text-[#65676B]">· {p.status} · {formatRupiah(p.totalAmount)}</span>
              </div>
              {(p.status === "draft" || p.status === "partially_received") && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const lines = poLines
                      .filter((l) => l.qty)
                      .map((l) => ({
                        variantId: l.variantId,
                        size: l.size.trim() || undefined,
                        quantity: Number(l.qty) || 0,
                      }));
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
