import { Shirt, Edit3 } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { QuickSetStockButton } from "../inventory/QuickSetStockButton";
import type { UniformVariantRow } from "./uniform-admin-api";

interface UniformVariantListProps {
  variants: UniformVariantRow[];
  searchQuery: string;
  isDemoMode?: boolean;
  onStockOverridden?: () => void;
  onEdit: (row: UniformVariantRow) => void;
}

function matchesUniformVariantSearch(row: UniformVariantRow, rawQuery: string): boolean {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return true;
  const { variant: v } = row;
  const kindLabel = v.kind === "kain_harian" ? "kain" : "olahraga";
  return (
    v.name.toLowerCase().includes(q) ||
    v.code.toLowerCase().includes(q) ||
    v.jenjang.toLowerCase().includes(q) ||
    kindLabel.includes(q)
  );
}

function SizeStockChips({
  variantName,
  variantId,
  stock,
  isDemoMode,
  onStockOverridden,
}: {
  variantName: string;
  variantId: string;
  stock: Array<{ size: string; quantity: number }>;
  isDemoMode?: boolean;
  onStockOverridden?: () => void;
}) {
  if (stock.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {stock.map((s) => (
        <span
          key={s.size}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#F8F9FA] border border-[#E4E6EB] text-[10px] font-mono"
        >
          <span>
            {s.size || "-"}:{s.quantity}
          </span>
          {isDemoMode && onStockOverridden && (
            <QuickSetStockButton
              label={`${variantName} (Size ${s.size})`}
              currentQuantity={s.quantity}
              overrideEndpoint="/api/demo/stock/uniform-override"
              payload={{ variantId, size: s.size }}
              onSuccess={onStockOverridden}
            />
          )}
        </span>
      ))}
    </div>
  );
}

export function UniformVariantList({ variants, searchQuery, isDemoMode, onStockOverridden, onEdit }: UniformVariantListProps) {
  const filtered = variants.filter((row) => matchesUniformVariantSearch(row, searchQuery));

  return (
    <>
      {/* Mobile view: compact cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="border border-[#E4E6EB] bg-white rounded-xl p-8 text-center text-xs text-[#65676B] shadow-xs">
            <Shirt className="w-8 h-8 mx-auto mb-2 text-[#CED0D4]" />
            {variants.length === 0 ? "Belum ada varian seragam terdaftar." : "Tidak ada varian yang cocok dengan pencarian."}
          </div>
        ) : (
          filtered.map((vRow) => {
            const { variant: v, sizes, stock } = vRow;
            const totalStock = stock.reduce((acc, curr) => acc + curr.quantity, 0);

            return (
              <div key={v.id} className="border border-[#E4E6EB] bg-white rounded-xl p-4 flex flex-col gap-2.5 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-[#050505] leading-snug">{v.name}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-[#F0F2F5] text-[10px] font-mono text-[#65676B] border border-[#CED0D4]/60">
                        {v.code}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#1877F2]">
                        {v.kind === "kain_harian" ? "Kain Harian" : "Olahraga"}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-[#65676B] uppercase">
                        {v.jenjang} · {v.gender === "male" ? "L" : "P"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(vRow)}
                    className="p-1.5 text-[#65676B] hover:text-[#1877F2] hover:bg-[#E7F3FF] rounded-lg transition-colors active:scale-[0.98] shrink-0"
                    title="Edit varian"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-[#65676B] flex items-center justify-between pt-1 border-t border-[#F0F2F5]">
                  <span className="font-bold text-[#1877F2] text-sm">{formatRupiah(v.price)}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#050505]">Stok: {totalStock} unit</span>
                    {isDemoMode && onStockOverridden && sizes.length === 0 && (
                      <QuickSetStockButton
                        label={v.name}
                        currentQuantity={totalStock}
                        overrideEndpoint="/api/demo/stock/uniform-override"
                        payload={{ variantId: v.id, size: "—" }}
                        onSuccess={onStockOverridden}
                      />
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-[#65676B]">
                  {sizes.length > 0 ? (
                    <SizeStockChips
                      variantName={v.name}
                      variantId={v.id}
                      stock={stock}
                      isDemoMode={isDemoMode}
                      onStockOverridden={onStockOverridden}
                    />
                  ) : (
                    <span>Ukuran: Meteran</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop view: structured table like CatalogBookList */}
      <div className="hidden md:block border border-[#E4E6EB] bg-white rounded-2xl shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E4E6EB] bg-[#F0F2F5] text-[#65676B] text-[11px] font-bold uppercase tracking-wider">
              <th className="py-3 px-4">Kode & Nama Seragam</th>
              <th className="py-3 px-4">Tipe & Jenjang</th>
              <th className="py-3 px-4">Ukuran Tersedia</th>
              <th className="py-3 px-4 text-right">Harga Satuan</th>
              <th className="py-3 px-4 text-center">Stok Gudang</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#65676B]">
                  <Shirt className="w-8 h-8 mx-auto mb-2 text-[#CED0D4]" />
                  {variants.length === 0 ? "Belum ada varian seragam terdaftar." : "Tidak ada varian yang cocok dengan pencarian."}
                </td>
              </tr>
            ) : (
              filtered.map((vRow) => {
                const { variant: v, sizes, stock } = vRow;
                const totalStock = stock.reduce((acc, curr) => acc + curr.quantity, 0);

                return (
                  <tr key={v.id} className="hover:bg-[#F0F2F5]/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold bg-[#F0F2F5] px-1.5 py-0.5 rounded text-[#65676B] border border-[#CED0D4]/60">
                          {v.code}
                        </span>
                        <div className="font-bold text-[#050505] text-sm">{v.name}</div>
                      </div>
                      <div className="text-[11px] text-[#65676B] mt-0.5">TA: {v.academicYear}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-[#1877F2]">
                          {v.kind === "kain_harian" ? "Kain Harian" : "Olahraga Jadi"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-[#65676B] uppercase">
                          {v.jenjang} · {v.gender === "male" ? "Laki-laki" : "Perempuan"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#65676B] font-medium">
                      {sizes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sizes.map((s) => (
                            <span key={s} className="px-1.5 py-0.2 rounded bg-[#F8F9FA] border border-[#E4E6EB] text-[10px] font-mono">
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="italic text-[#65676B]/70">Tanpa ukuran (meter)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="font-bold text-[#1877F2] text-sm">{formatRupiah(v.price)}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-bold text-[#050505]">{totalStock} <span className="text-[10px] font-normal text-[#65676B]">unit</span></span>
                        {isDemoMode && onStockOverridden && sizes.length === 0 && (
                          <QuickSetStockButton
                            label={v.name}
                            currentQuantity={totalStock}
                            overrideEndpoint="/api/demo/stock/uniform-override"
                            payload={{ variantId: v.id, size: "—" }}
                            onSuccess={onStockOverridden}
                          />
                        )}
                      </div>
                      <SizeStockChips
                        variantName={v.name}
                        variantId={v.id}
                        stock={stock}
                        isDemoMode={isDemoMode}
                        onStockOverridden={onStockOverridden}
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onEdit(vRow)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#CED0D4] bg-white rounded-lg text-xs font-semibold text-[#050505] hover:bg-[#F0F2F5] hover:text-[#1877F2] active:scale-[0.98] transition-all shadow-2xs"
                        title="Edit varian"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
