import { Trash2 } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { UniformVariantRow } from "./uniform-admin-api";

export interface MatrixPoItem {
  variantId: string;
  unitPrice: number;
  sizeQuantities: Record<string, number>;
  singleQuantity: number;
}

interface UniformPoItemCardProps {
  item: MatrixPoItem;
  variantRow?: UniformVariantRow;
  isHighlighted: boolean;
  onUpdatePrice: (variantId: string, price: number) => void;
  onUpdateSizeQty: (variantId: string, size: string, qty: number) => void;
  onUpdateSingleQty: (variantId: string, qty: number) => void;
  onRemoveItem: (variantId: string) => void;
}

export function getItemTotalQty(item: MatrixPoItem, hasSizes: boolean): number {
  if (hasSizes) {
    return Object.values(item.sizeQuantities).reduce((a, b) => a + (b || 0), 0);
  }
  return item.singleQuantity || 0;
}

export function UniformPoItemCard({
  item,
  variantRow,
  isHighlighted,
  onUpdatePrice,
  onUpdateSizeQty,
  onUpdateSingleQty,
  onRemoveItem,
}: UniformPoItemCardProps) {
  const v = variantRow?.variant;
  const validSizes = variantRow?.sizes && variantRow.sizes.length > 0 ? variantRow.sizes : [];
  const hasSizes = validSizes.length > 0;
  const itemTotalQty = getItemTotalQty(item, hasSizes);
  const itemSubtotal = itemTotalQty * (item.unitPrice || 0);

  return (
    <div
      className={`p-3.5 rounded-2xl border transition-all ${
        isHighlighted
          ? "bg-amber-50/70 border-amber-400 ring-2 ring-amber-300"
          : "bg-white border-[#E4E6EB] hover:border-[#CED0D4] shadow-2xs"
      }`}
    >
      {/* Baris Atas: Informasi Model & Harga Satuan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#F0F2F5]">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs text-[#050505]">{v?.name ?? "Varian Seragam"}</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#E4E6EB] text-[#050505]">
              {v?.jenjang}
            </span>
          </div>
          <span className="text-[10px] text-[#65676B] font-mono">{v?.code}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-[#65676B] whitespace-nowrap">Harga Satuan (Rp):</label>
            <input
              type="number"
              min="0"
              value={item.unitPrice || ""}
              onChange={(e) => onUpdatePrice(item.variantId, parseInt(e.target.value) || 0)}
              className="w-28 px-2 py-1 bg-white border border-[#CED0D4] rounded-lg text-xs font-semibold text-right text-[#050505] focus:outline-none focus:border-[#1877F2]"
              placeholder="0"
            />
          </div>

          <button
            type="button"
            onClick={() => onRemoveItem(item.variantId)}
            className="p-1.5 text-[#65676B] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
            title="Hapus seragam ini"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Baris Bawah: Matriks Input Ukuran & Subtotal */}
      <div className="pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {hasSizes ? (
          <div className="flex-1">
            <span className="text-[10px] font-semibold text-[#65676B] block mb-1.5">
              Kuantitas Order per Ukuran (Pcs):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {validSizes.map((sz) => {
                const currentQty = item.sizeQuantities[sz] ?? 0;
                return (
                  <div
                    key={sz}
                    className="flex items-center border border-[#CED0D4] rounded-lg overflow-hidden bg-[#F8F9FA] focus-within:border-[#1877F2] focus-within:ring-1 focus-within:ring-[#1877F2]"
                  >
                    <span className="px-2 py-1 bg-[#E4E6EB] text-[10px] font-bold text-[#050505] min-w-7 text-center border-r border-[#CED0D4]">
                      {sz}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={currentQty === 0 ? "" : currentQty}
                      placeholder="0"
                      onChange={(e) =>
                        onUpdateSizeQty(item.variantId, sz, parseInt(e.target.value) || 0)
                      }
                      className="w-12 px-1.5 py-1 text-xs font-semibold text-center text-[#050505] bg-white focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#65676B]">
              Kuantitas (All Size / Tanpa Ukuran):
            </span>
            <input
              type="number"
              min="1"
              value={item.singleQuantity || ""}
              placeholder="0"
              onChange={(e) => onUpdateSingleQty(item.variantId, parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 bg-white border border-[#CED0D4] rounded-lg text-xs font-semibold text-center text-[#050505] focus:outline-none focus:border-[#1877F2]"
            />
            <span className="text-xs text-[#65676B]">pcs</span>
          </div>
        )}

        {/* Ringkasan Subtotal Baris */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 bg-[#F8F9FA] sm:bg-transparent p-2 sm:p-0 rounded-xl">
          <span className="text-[11px] text-[#65676B]">
            Total: <strong className="text-[#050505]">{itemTotalQty} pcs</strong>
          </span>
          <span className="text-xs font-bold text-[#1877F2]">{formatRupiah(itemSubtotal)}</span>
        </div>
      </div>
    </div>
  );
}
