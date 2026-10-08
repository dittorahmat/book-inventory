import type { BookItem } from "../../types";
import { formatRupiah } from "../../lib/transfer-pricing";
import { effectiveSellPrice } from "../../lib/book-pricing";

interface LoosePickerProps {
  items: BookItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function LoosePicker({ items, selectedIds, onToggle }: LoosePickerProps) {
  if (items.length === 0) {
    return (
      <div className="text-[#65676B] py-3 text-center">
        Tidak ada buku siap kirim di cabang ini.
      </div>
    );
  }
  return (
    <>
      {items.map((item) => (
        <label
          key={item.id}
          className="flex items-center justify-between py-1.5 px-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={() => onToggle(item.id)}
              className="rounded border-[#CED0D4] text-[#1877F2] focus:ring-[#1877F2] w-4 h-4 shrink-0"
            />
            <span className="font-mono text-xs font-bold text-[#1877F2] shrink-0">{item.barcode}</span>
            <span className="text-[#050505] font-medium truncate">({item.book?.title})</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-[#1877F2]">{formatRupiah(effectiveSellPrice(item.book ?? {}))}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                item.condition === "damaged"
                  ? "bg-red-100 text-[#FA383E]"
                  : item.condition === "new"
                  ? "bg-emerald-100 text-[#31A24C]"
                  : "bg-white text-[#65676B] border border-[#CED0D4]"
              }`}
            >
              {item.condition}
            </span>
          </div>
        </label>
      ))}
    </>
  );
}
