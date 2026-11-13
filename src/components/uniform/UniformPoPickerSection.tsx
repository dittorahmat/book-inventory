import { Search, X, Filter, CheckCircle2 } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { UNIFORM_INPUT_CLS } from "./uniform-styles";
import type { UniformVariantRow } from "./uniform-admin-api";

const JENJANG_FILTERS = ["ALL", "TK", "SD", "SMP", "SMA"];

interface UniformPoPickerSectionProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedJenjang: string;
  setSelectedJenjang: (jenjang: string) => void;
  isPickerOpen: boolean;
  setIsPickerOpen: (open: boolean) => void;
  filteredVariants: UniformVariantRow[];
  selectedVariantIds: Set<string>;
  onSelectItem: (variantId: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function UniformPoPickerSection({
  searchTerm,
  setSearchTerm,
  selectedJenjang,
  setSelectedJenjang,
  isPickerOpen,
  setIsPickerOpen,
  filteredVariants,
  selectedVariantIds,
  onSelectItem,
  inputRef,
}: UniformPoPickerSectionProps) {
  return (
    <div className="space-y-2 p-3.5 bg-[#F8F9FA] rounded-2xl border border-[#E4E6EB]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Search className="w-4 h-4 text-[#1877F2]" />
          <label className="text-xs font-bold text-[#050505]">Pilih & Tambah Seragam ke PO</label>
        </div>

        {/* Jenjang Filter Badges */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <span className="text-[10px] text-[#65676B] font-medium mr-1 flex items-center gap-0.5">
            <Filter className="w-3 h-3" /> Jenjang:
          </span>
          {JENJANG_FILTERS.map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => setSelectedJenjang(j)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all active:scale-[0.98] ${
                selectedJenjang === j
                  ? "bg-[#1877F2] text-white shadow-2xs"
                  : "bg-white text-[#65676B] border border-[#CED0D4] hover:bg-[#F0F2F5]"
              }`}
            >
              {j}
            </button>
          ))}
        </div>
      </div>

      {/* Input Searchable Combobox */}
      <div className="relative">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#65676B]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Ketik nama atau kode seragam (contoh: olahraga sd, khimar, batik)..."
            value={searchTerm}
            onFocus={() => setIsPickerOpen(true)}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsPickerOpen(true);
            }}
            className={`${UNIFORM_INPUT_CLS} pl-9 pr-8 shadow-2xs`}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#65676B] hover:text-[#050505] p-1 rounded-md active:scale-[0.98]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Popover Hasil Pencarian */}
        {isPickerOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#CED0D4] rounded-xl shadow-lg z-20 max-h-56 overflow-y-auto p-1.5 divide-y divide-[#F0F2F5] animate-in fade-in duration-100">
            {filteredVariants.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#65676B]">
                Tidak ada varian seragam yang cocok dengan kata kunci & filter.
              </div>
            ) : (
              filteredVariants.map(({ variant: v, sizes }) => {
                const isAdded = selectedVariantIds.has(v.id);
                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-2 hover:bg-[#F8F9FA] rounded-lg cursor-pointer transition-colors active:scale-[0.98]"
                    onClick={() => onSelectItem(v.id)}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-[#050505] truncate">{v.name}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#E4E6EB] text-[#050505]">
                          {v.jenjang}
                        </span>
                        {v.gender && (
                          <span className="text-[10px] text-[#65676B] capitalize">({v.gender})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#65676B]">
                        <span className="font-mono">{v.code}</span>
                        <span>•</span>
                        <span>
                          {sizes && sizes.length > 0 ? `Ukuran: ${sizes.join(", ")}` : "All Size"}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#1877F2]">
                        {formatRupiah(v.price)}
                      </span>
                      {isAdded ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Dipilih
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-[#1877F2]/10 text-[#1877F2] text-[10px] font-bold hover:bg-[#1877F2] hover:text-white transition-colors active:scale-[0.98]">
                          + Tambah
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {isPickerOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setIsPickerOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
