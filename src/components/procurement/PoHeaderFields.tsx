import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { Supplier } from "./procurement-types";

interface PoHeaderFieldsProps {
  suppliers: Supplier[];
  supplierId: string;
  onSupplierChange: (id: string) => void;
  onOpenSupplierModal: () => void;
  orderDate: string;
  onOrderDateChange: (date: string) => void;
  expectedArrival: string;
  onExpectedArrivalChange: (date: string) => void;
  loadError?: string | null;
}

export function PoHeaderFields({
  suppliers,
  supplierId,
  onSupplierChange,
  onOpenSupplierModal,
  orderDate,
  onOrderDateChange,
  expectedArrival,
  onExpectedArrivalChange,
  loadError,
}: PoHeaderFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {loadError && (
        <div className="col-span-1 sm:col-span-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">
          {loadError}
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-[#050505] mb-1">
          Supplier / Vendor Resmi *
        </label>
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <SearchableSingleSelect
              options={suppliers.map((s) => ({ value: s.id, label: s.name, hint: s.code }))}
              value={supplierId}
              onChange={onSupplierChange}
              placeholder={suppliers.length === 0 ? "Belum ada supplier (Tambah baru)" : "Pilih supplier..."}
              required
            />
          </div>
          <button
            type="button"
            onClick={onOpenSupplierModal}
            className="px-2.5 py-2 border border-[#CED0D4] rounded-xl hover:bg-[#F0F2F5] text-xs font-semibold shrink-0"
            title="Tambah Supplier Baru"
          >
            + Baru
          </button>
        </div>
      </div>

      <div>
        <span className="block text-xs font-semibold text-[#050505] mb-1">
          Tujuan Barang Masuk
        </span>
        <div className="w-full px-3 py-2 bg-[#F0F2F5] border border-[#E4E6EB] rounded-xl text-xs font-semibold text-[#050505]">
          Gudang Logistik
        </div>
        <p className="text-[10px] text-[#65676B] mt-1">
          PO selalu dipusatkan di Gudang Logistik, lalu diteruskan ke cabang lewat transfer.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#050505] mb-1">
          Tanggal Order *
        </label>
        <input
          type="date"
          value={orderDate}
          onChange={(e) => onOrderDateChange(e.target.value)}
          required
          className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#050505] mb-1">
          Estimasi Tiba di Gudang
        </label>
        <input
          type="date"
          value={expectedArrival}
          onChange={(e) => onExpectedArrivalChange(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
        />
      </div>
    </div>
  );
}
