import { Plus, Search } from "lucide-react";

interface CatalogToolbarProps {
  totalCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAdd: () => void;
}

/** Bilah kepala katalog: judul + pencarian + CTA tambah. */
export function CatalogToolbar({ totalCount, searchQuery, onSearchChange, onAdd }: CatalogToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-[#E4E6EB] shadow-xs">
      <div>
        <h2 className="text-xl font-bold text-[#050505]">
          Central Book Catalog
        </h2>
        <p className="text-xs text-[#65676B] mt-0.5">
          Master data buku global ({totalCount} judul terdaftar).
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#65676B]" />
          <input
            type="text"
            placeholder="Cari judul, ISBN, penulis..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-3 py-2 text-xs font-medium border border-[#CED0D4] rounded-full bg-[#F0F2F5] hover:bg-[#E4E6EB] focus:bg-white w-full sm:w-72 focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] transition-all placeholder-[#8A8D91]"
          />
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Tambah Buku
        </button>
      </div>
    </div>
  );
}
