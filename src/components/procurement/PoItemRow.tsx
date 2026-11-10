import { Trash2, Users, Warehouse } from "lucide-react";
import type { Book } from "../../types";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { NewPOItemInput } from "./procurement-types";
import { type BookDemandItemInfo, calcBufferQty } from "./po-demand-helpers";

export interface PoItemRowProps {
  idx: number;
  item: NewPOItemInput;
  eligibleBooks: Book[];
  bufferPercent: number;
  demand?: BookDemandItemInfo;
  onUpdate: (index: number, field: keyof NewPOItemInput, val: string | number) => void;
  onRemove: (index: number) => void;
}

export function PoItemRow({
  idx,
  item,
  eligibleBooks,
  bufferPercent,
  demand,
  onUpdate,
  onRemove,
}: PoItemRowProps) {
  const sCount = demand?.studentCount ?? 0;
  const upBuffer = calcBufferQty(sCount, bufferPercent);
  const wStock = demand?.warehouseStock ?? 0;

  return (
    <div className="p-3 bg-[#F9FAFB] border border-[#E4E6EB] rounded-xl grid grid-cols-12 gap-2.5 items-center">
      {/* 1. Judul Buku (min-w-0 agar truncate bekerja rapi tanpa meluap) */}
      <div className="col-span-12 lg:col-span-4 min-w-0">
        <label className="block text-[10px] text-[#65676B] mb-0.5">Judul Buku</label>
        <SearchableSingleSelect
          options={eligibleBooks.map((b) => ({ value: b.id, label: b.title, hint: b.isbn }))}
          value={item.bookId}
          onChange={(val) => onUpdate(idx, "bookId", val)}
          placeholder="Cari judul..."
          hideClearButton
        />
      </div>

      {/* 2. Rincian Angka Pembuktian Logistik (Siswa, Up Buffer, Stok Gudang) */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3 grid grid-cols-3 gap-1.5 p-1.5 bg-white border border-[#E4E6EB] rounded-lg text-center">
        <div>
          <span className="block text-[9px] font-medium text-[#65676B]">Siswa</span>
          <span className="text-xs font-bold text-[#050505] flex items-center justify-center gap-0.5" title={`${sCount} siswa membutuhkan buku ini`}>
            <Users className="w-3 h-3 text-[#1877F2]" />
            {sCount}
          </span>
        </div>
        <div className="border-x border-[#E4E6EB]">
          <span className="block text-[9px] font-medium text-[#65676B]">Up {bufferPercent}%</span>
          <span className="text-xs font-bold text-[#1877F2]" title={`Up ${bufferPercent}%: ${upBuffer} eksemplar`}>
            {upBuffer}
          </span>
        </div>
        <div>
          <span className="block text-[9px] font-medium text-[#65676B]">Stok Gudang</span>
          <span className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-0.5" title={`Stok fisik lepas saat ini: ${wStock} unit`}>
            <Warehouse className="w-3 h-3 text-emerald-600" />
            {wStock}
          </span>
        </div>
      </div>

      {/* 3. Input Qty Pesan */}
      <div className="col-span-4 sm:col-span-2 lg:col-span-1 min-w-[56px]">
        <label className="block text-[10px] text-[#65676B] mb-0.5 text-center">Qty Pesan</label>
        <input
          type="number"
          min={0}
          placeholder="0"
          value={item.quantityOrdered === 0 ? "" : item.quantityOrdered}
          onChange={(e) => onUpdate(idx, "quantityOrdered", e.target.value)}
          className="w-full px-1.5 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs text-center font-bold text-[#1877F2] focus:border-[#1877F2] focus:outline-hidden"
          title={`Formula: max(0, Up Buffer ${upBuffer} - Stok ${wStock}) = ${Math.max(0, upBuffer - wStock)}`}
        />
      </div>

      {/* 4. Harga Satuan Katalog */}
      <div className="col-span-4 sm:col-span-2 lg:col-span-2 min-w-0">
        <label className="block text-[10px] text-[#65676B] mb-0.5 text-right">
          Harga Satuan <span className="text-[9px] text-[#8A8D91]">(Katalog)</span>
        </label>
        <input
          type="number"
          readOnly
          tabIndex={-1}
          placeholder="0"
          value={item.unitPrice === 0 ? "" : item.unitPrice}
          className="w-full px-2 py-1.5 bg-[#F0F2F5] border border-[#E4E6EB] rounded-lg text-xs font-semibold text-right text-[#65676B] cursor-not-allowed select-none"
          title="Harga satuan terkunci mengikuti harga beli di katalog"
        />
      </div>

      {/* 5. Diskon (%) */}
      <div className="col-span-3 sm:col-span-1 lg:col-span-1 min-w-[50px]">
        <label className="block text-[10px] text-[#65676B] mb-0.5 text-right">Diskon %</label>
        <input
          type="number"
          min={0}
          max={100}
          placeholder="0"
          value={item.discountPercent === 0 ? "" : item.discountPercent}
          onChange={(e) => onUpdate(idx, "discountPercent", e.target.value)}
          className="w-full px-1.5 py-1.5 bg-white border border-[#CED0D4] rounded-lg text-xs font-semibold text-right focus:border-[#1877F2] focus:outline-hidden"
        />
      </div>

      {/* 6. Aksi Hapus */}
      <div className="col-span-1 sm:col-span-1 lg:col-span-1 flex justify-end items-center pt-3 sm:pt-0">
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors active:scale-95"
          title="Hapus baris"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
