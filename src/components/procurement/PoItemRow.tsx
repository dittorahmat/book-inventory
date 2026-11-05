import { Trash2, Users, Warehouse } from "lucide-react";
import type { Book } from "../../types";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { NewPOItemInput } from "./procurement-types";
import type { BookDemandItemInfo } from "./po-demand-helpers";

interface PoItemRowProps {
  idx: number;
  item: NewPOItemInput;
  eligibleBooks: Book[];
  demand?: BookDemandItemInfo;
  onUpdate: (index: number, field: keyof NewPOItemInput, val: string | number) => void;
  onRemove: (index: number) => void;
}

export function PoItemRow({
  idx,
  item,
  eligibleBooks,
  demand,
  onUpdate,
  onRemove,
}: PoItemRowProps) {
  const sCount = demand?.studentCount ?? 0;
  const wStock = demand?.warehouseStock ?? 0;

  return (
    <div className="p-3 bg-[#F9FAFB] border border-[#E4E6EB] rounded-xl grid grid-cols-12 gap-2.5 items-center">
      <div className="col-span-12 sm:col-span-5">
        <label className="block text-[10px] text-[#65676B] mb-0.5">Judul Buku</label>
        <SearchableSingleSelect
          options={eligibleBooks.map((b) => ({ value: b.id, label: b.title, hint: b.isbn }))}
          value={item.bookId}
          onChange={(val) => onUpdate(idx, "bookId", val)}
          placeholder="Cari judul..."
        />
      </div>

      <div className="col-span-5 sm:col-span-2">
        <div className="flex items-center justify-between mb-0.5">
          <label className="block text-[10px] text-[#65676B]">Qty Pesan</label>
          <span
            className="text-[9px] text-[#65676B] flex items-center gap-0.5"
            title={`Siswa: ${sCount} anak | Stok Gudang: ${wStock} unit`}
          >
            <Users className="w-2.5 h-2.5 text-blue-600" />
            {sCount}
            <Warehouse className="w-2.5 h-2.5 ml-1 text-emerald-600" />
            {wStock}
          </span>
        </div>
        <input
          type="number"
          min={0}
          placeholder="0"
          value={item.quantityOrdered === 0 ? "" : item.quantityOrdered}
          onChange={(e) => onUpdate(idx, "quantityOrdered", e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs text-center font-bold text-[#1877F2]"
        />
      </div>

      <div className="col-span-5 sm:col-span-2">
        <label className="block text-[10px] text-[#65676B] mb-0.5">
          Harga Satuan (Rp) <span className="text-[9px] text-[#8A8D91]">(Katalog)</span>
        </label>
        <input
          type="number"
          readOnly
          tabIndex={-1}
          placeholder="0"
          value={item.unitPrice === 0 ? "" : item.unitPrice}
          className="w-full px-2.5 py-1.5 bg-[#F0F2F5] border border-[#E4E6EB] rounded-lg text-xs font-semibold text-right text-[#65676B] cursor-not-allowed select-none"
          title="Harga satuan terkunci mengikuti harga beli di katalog"
        />
      </div>

      <div className="col-span-5 sm:col-span-2">
        <label className="block text-[10px] text-[#65676B] mb-0.5">Diskon (%)</label>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          placeholder="0"
          value={item.discountPercent === 0 ? "" : item.discountPercent}
          onChange={(e) => onUpdate(idx, "discountPercent", e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs font-semibold text-right"
        />
      </div>

      <div className="col-span-2 sm:col-span-1 flex justify-end pt-3 sm:pt-0">
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Hapus baris"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
