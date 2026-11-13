import { Search, SlidersHorizontal, RefreshCw } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";

interface UniformShipmentToolbarProps {
  schools: Array<{ id: string; name: string }>;
  lockedSchoolId?: string | null;
  schoolId: string;
  setSchoolId: (val: string) => void;
  status: string;
  setStatus: (val: string) => void;
  search: string;
  setSearch: (val: string) => void;
  loading: boolean;
  onRefresh: () => void;
  onOpenBatch: () => void;
}

export function UniformShipmentToolbar({
  schools,
  lockedSchoolId,
  schoolId,
  setSchoolId,
  status,
  setStatus,
  search,
  setSearch,
  loading,
  onRefresh,
  onOpenBatch,
}: UniformShipmentToolbarProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#050505]">Daftar Pengiriman Seragam</h2>
          <p className="text-xs text-[#65676B]">
            Pantau status fulfillment, nomor resi ekspedisi, dan invoice seragam siswa.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={onOpenBatch}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#CED0D4] bg-white text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#F0F2F5] active:scale-[0.98] transition-all shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#1877F2]" />
            <span>Ekspor & Impor CSV</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 border border-[#CED0D4] bg-white text-[#65676B] hover:text-[#050505] rounded-xl text-xs hover:bg-[#F0F2F5] active:scale-[0.98] transition-all shadow-2xs"
            title="Segarkan data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-[#E4E6EB]">
        <div>
          <SearchableSingleSelect
            label="Sekolah"
            options={[
              ...(!lockedSchoolId ? [{ value: "", label: "🏢 Semua Cabang" }] : []),
              ...schools.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={schoolId}
            onChange={setSchoolId}
            placeholder="Pilih sekolah / cabang..."
            disabled={!!lockedSchoolId}
          />
        </div>

        <div>
          <SearchableSingleSelect
            label="Status Pengiriman"
            options={[
              { value: "belum_dikirim", label: "Belum terkirim" },
              { value: "sudah_dikirim", label: "Sudah terkirim" },
              { value: "superseded", label: "Tertimpa (Superseded)" },
              { value: "", label: "Semua Status" },
            ]}
            value={status}
            onChange={setStatus}
            placeholder="Pilih status..."
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#050505] mb-1">Cari Order</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#65676B]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onRefresh()}
              placeholder="Cari nama siswa, NIS, atau no. order..."
              className="pl-9 pr-3 py-2 text-xs font-medium border border-[#CED0D4] rounded-xl bg-white hover:border-[#1877F2] w-full focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
