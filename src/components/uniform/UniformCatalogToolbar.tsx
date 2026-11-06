import { Plus, Search, ChevronUp } from "lucide-react";

interface UniformCatalogToolbarProps {
  totalCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showForm: boolean;
  onToggleForm: () => void;
}

/**
 * Bilah kepala / toolbar katalog seragam: judul + pencarian + tombol toggle tambah varian.
 * Mengikuti gaya CatalogToolbar pada katalog buku.
 */
export function UniformCatalogToolbar({
  totalCount,
  searchQuery,
  onSearchChange,
  showForm,
  onToggleForm,
}: UniformCatalogToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E6EB] shadow-xs">
      <div>
        <h2 className="text-xl font-bold text-[#050505]">
          Katalog Seragam Sekolah
        </h2>
        <p className="text-xs text-[#65676B] mt-0.5">
          Master data bahan kain harian dan set seragam olahraga ({totalCount} varian terdaftar).
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#65676B]" />
          <input
            type="text"
            placeholder="Cari varian, kode, jenjang..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-3 py-2 text-xs font-medium border border-[#CED0D4] rounded-full bg-[#F0F2F5] hover:bg-[#E4E6EB] focus:bg-white w-full sm:w-72 focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] transition-all placeholder-[#8A8D91]"
          />
        </div>

        <button
          type="button"
          onClick={onToggleForm}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-xs active:scale-[0.98] ${
            showForm
              ? "bg-[#F0F2F5] text-[#050505] hover:bg-[#E4E6EB]"
              : "bg-[#1877F2] text-white hover:bg-[#166FE5]"
          }`}
        >
          {showForm ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Tutup Form
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Tambah Varian
            </>
          )}
        </button>
      </div>
    </div>
  );
}
