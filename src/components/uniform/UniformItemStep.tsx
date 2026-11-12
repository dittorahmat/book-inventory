import { useState } from "react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { UniformSizeGuideModal } from "./UniformSizeGuideModal";
import { formatUniformSizeLabel, normalizeUniformJenjang } from "../../lib/uniform-size-chart";
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
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [sizeWarningId, setSizeWarningId] = useState<string | null>(null);
  const olahraga = order.visibleVariants.filter((v) => v.kind === "olahraga");
  const studentJenjang = normalizeUniformJenjang(order.student?.gradeLevel);
  const stockOf = (variantId: string, size: string) =>
    order.catalog?.variants.find((v) => v.id === variantId)?.stock.find((s) => s.size === size)?.quantity ?? 0;

  return (
    <div className="space-y-6">
      {order.visiblePackages.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-[#050505]">Paket Bahan Seragam Harian</h3>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Bahan Kain / Tanpa Ukuran
            </span>
          </div>
          <p className="text-xs text-[#65676B] mb-3">Bundel bahan kain kemeja, celana/rok, dan jilbab/batik (tanpa ukuran) yang dijahit sendiri oleh orang tua.</p>
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

      {olahraga.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-[#050505]">Seragam Olahraga</h3>
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="text-xs font-semibold text-[#1877F2] hover:underline flex items-center gap-1"
            >
              📏 Lihat Panduan Ukuran (cm)
            </button>
          </div>
          <p className="text-xs text-[#65676B] mb-3">Pakaian jadi konveksi — wajib memilih ukuran sesuai lebar dada (LD) dan panjang (P).</p>
          <div className="space-y-3">
            {olahraga.map((v) => {
              const picked = order.sizeFor[v.id] ?? "";
              const key = picked ? `${v.id}::${picked}` : v.id;
              const currentQty = order.satuanQty[key] ?? order.satuanQty[v.id] ?? 0;
              const sizeOptions = v.sizes.map((s) => {
                const detail = v.sizeDetails?.find((d) => d.size === s);
                const label = detail ? formatUniformSizeLabel(detail) : s;
                return { value: s, label: `${label} · Stok: ${stockOf(v.id, s)}` };
              });

              const handleSizeChange = (val: string) => {
                order.setSizeFor((s) => ({ ...s, [v.id]: val }));
                setSizeWarningId(null);
                // Jika sudah ada kuantitas, migrasikan kuantitas ke kunci baru
                if (currentQty > 0) {
                  order.bumpSatuan(key, -currentQty);
                  const newKey = val ? `${v.id}::${val}` : v.id;
                  order.bumpSatuan(newKey, currentQty);
                }
              };

              const handleStepperChange = (delta: number) => {
                if (!picked && delta > 0) {
                  setSizeWarningId(v.id);
                  return;
                }
                order.bumpSatuan(key, delta);
              };

              return (
                <div key={v.id} className="bg-white rounded-2xl border border-[#E4E6EB] p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold">{v.name}</div>
                      <div className="text-xs text-[#65676B]">{formatRupiah(v.price)}</div>
                    </div>
                    {stepper(currentQty, handleStepperChange, false)}
                  </div>
                  <div>
                    <SearchableSingleSelect
                      label="Pilih Ukuran Olahraga (Wajib)"
                      options={sizeOptions}
                      value={picked}
                      onChange={handleSizeChange}
                      placeholder="— Pilih ukuran olahraga —"
                    />
                    {(!picked || sizeWarningId === v.id) && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        ⚠️ Wajib memilih ukuran seragam olahraga sebelum menambahkan atau melanjutkan pesanan.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {order.visiblePackages.length + olahraga.length === 0 && (
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
      <UniformSizeGuideModal
        jenjang={studentJenjang}
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
