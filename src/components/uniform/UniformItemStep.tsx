import { formatRupiah } from "../../lib/transfer-pricing";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { UniformOrder } from "./useUniformOrder";

const stepper = (qty: number, onChange: (delta: number) => void, disabled = false) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      disabled={disabled || qty === 0}
      onClick={() => onChange(-1)}
      className="w-8 h-8 rounded-lg border border-[#CED0D4] text-sm font-bold text-[#050505] disabled:opacity-30 hover:bg-[#F0F2F5] active:scale-[0.98]"
    >
      −
    </button>
    <span className="w-6 text-center text-sm font-bold">{qty}</span>
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(1)}
      className="w-8 h-8 rounded-lg bg-[#1877F2] text-sm font-bold text-white disabled:opacity-30 hover:bg-[#1664D9] active:scale-[0.98]"
    >
      +
    </button>
  </div>
);

export function UniformItemStep({ order }: { order: UniformOrder }) {
  const kain = order.visibleVariants.filter((v) => v.kind === "kain_harian");
  const olahraga = order.visibleVariants.filter((v) => v.kind === "olahraga");
  const stockOf = (variantId: string, size: string) =>
    order.catalog?.variants.find((v) => v.id === variantId)?.stock.find((s) => s.size === size)?.quantity ?? 0;

  return (
    <div className="space-y-6">
      {order.visiblePackages.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-[#050505] mb-1">Paket Seragam</h3>
          <p className="text-xs text-[#65676B] mb-3">Bundel kain harian + olahraga, dirakit gudang pusat.</p>
          <div className="space-y-3">
            {order.visiblePackages.map((p) => {
              const needsSize = p.bom.some((b) => {
                const v = order.catalog?.variants.find((x) => x.id === b.variantId);
                return v?.kind === "olahraga" && b.size === "—";
              });
              const sizeOptions = [
                ...new Set(
                  p.bom.flatMap((b) => {
                    const v = order.catalog?.variants.find((x) => x.id === b.variantId);
                    return v?.kind === "olahraga" && b.size === "—" ? v.sizes : [];
                  })
                ),
              ];
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-[#E4E6EB] p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold">{p.name}</div>
                      <div className="text-xs text-[#65676B]">{p.bom.map((b) => b.variantName).join(" + ")}</div>
                      <div className="text-xs font-semibold text-[#1877F2] mt-0.5">{formatRupiah(p.price)}</div>
                      <div className="text-[11px] text-[#65676B]">Siap kirim: {p.readyQty}</div>
                    </div>
                    {stepper(order.packageQty[p.id] ?? 0, (d) => order.bumpPackage(p.id, d))}
                  </div>
                  {needsSize && (order.packageQty[p.id] ?? 0) > 0 && (
                    <div>
                      <SearchableSingleSelect
                        label="Ukuran olahraga dalam paket"
                        options={sizeOptions.map((s) => ({ value: s, label: s }))}
                        value={order.sizeFor[p.id] ?? ""}
                        onChange={(v) => order.setSizeFor((s) => ({ ...s, [p.id]: v }))}
                        placeholder="— Pilih ukuran —"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {kain.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-[#050505] mb-1">Kain Harian Satuan</h3>
          <p className="text-xs text-[#65676B] mb-3">Paket kain tanpa ukuran.</p>
          <div className="bg-white rounded-2xl border border-[#E4E6EB] divide-y divide-[#E4E6EB]">
            {kain.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{v.name}</div>
                  <div className="text-xs text-[#65676B]">{formatRupiah(v.price)} · Stok: {stockOf(v.id, "—")}</div>
                </div>
                {stepper(order.satuanQty[v.id] ?? 0, (d) => order.bumpSatuan(v.id, d))}
              </div>
            ))}
          </div>
        </section>
      )}

      {olahraga.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-[#050505] mb-1">Olahraga Satuan</h3>
          <p className="text-xs text-[#65676B] mb-3">Pakaian jadi — pilih ukuran sesuai size chart.</p>
          <div className="space-y-3">
            {olahraga.map((v) => {
              const picked = order.sizeFor[v.id] ?? "";
              const key = picked ? `${v.id}::${picked}` : v.id;
              return (
                <div key={v.id} className="bg-white rounded-2xl border border-[#E4E6EB] p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold">{v.name}</div>
                      <div className="text-xs text-[#65676B]">{formatRupiah(v.price)}</div>
                      {v.sizeChartUrl && (
                        <a href={v.sizeChartUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#1877F2] underline">
                          Lihat size chart
                        </a>
                      )}
                    </div>
                    {stepper(order.satuanQty[key] ?? 0, (d) => order.bumpSatuan(key, d), !picked)}
                  </div>
                  <div>
                    <SearchableSingleSelect
                      label="Ukuran"
                      options={v.sizes.map((s) => ({ value: s, label: `${s} (stok ${stockOf(v.id, s)})` }))}
                      value={picked}
                      onChange={(val) => order.setSizeFor((s) => ({ ...s, [v.id]: val }))}
                      placeholder="— Pilih ukuran —"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {order.visiblePackages.length + kain.length + olahraga.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] p-6 text-center text-xs text-[#65676B]">
          Belum ada katalog seragam untuk jenjang/gender murid ini pada tahun ajaran tersebut.
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={order.backToSearch}
          className="px-5 py-2.5 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
        >
          Kembali
        </button>
        <div className="text-sm font-bold">Total: {formatRupiah(order.total)}</div>
        <button
          type="button"
          disabled={order.itemCount === 0}
          onClick={() => order.setStep(3)}
          className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-40 hover:bg-[#1664D9] active:scale-[0.98]"
        >
          Lanjut
        </button>
      </div>
    </div>
  );
}
