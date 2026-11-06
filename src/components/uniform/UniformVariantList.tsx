import { Shirt, Edit3 } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { UniformVariantRow } from "./uniform-admin-api";

interface UniformVariantListProps {
  variants: UniformVariantRow[];
  searchQuery: string;
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

export function UniformVariantList({ variants, searchQuery, onEdit }: UniformVariantListProps) {
  const filtered = variants.filter((row) => matchesUniformVariantSearch(row, searchQuery));

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] divide-y divide-[#E4E6EB] overflow-hidden shadow-xs">
      <div className="px-4 py-3 bg-[#F0F2F5]/60 flex items-center justify-between text-xs font-bold text-[#65676B]">
        <span>Daftar Varian ({filtered.length} ditemukan)</span>
        <span>Aksi</span>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-12 text-center text-xs text-[#65676B]">
          <Shirt className="w-8 h-8 mx-auto mb-2 text-[#CED0D4]" />
          {variants.length === 0 ? "Belum ada varian seragam terdaftar." : "Tidak ada varian yang cocok dengan pencarian."}
        </div>
      ) : (
        filtered.map((vRow) => {
          const { variant: v, sizes, stock } = vRow;
          const totalStock = stock.reduce((acc, curr) => acc + curr.quantity, 0);

          return (
            <div key={v.id} className="p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F0F2F5]/40 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-[#050505]">{v.name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#F0F2F5] text-[11px] font-mono text-[#65676B] border border-[#CED0D4]/60">
                    {v.code}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-[#1877F2]">
                    {v.kind === "kain_harian" ? "Kain Harian" : "Olahraga Jadi"}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-[#65676B] uppercase">
                    {v.jenjang} · {v.gender === "male" ? "Laki-laki" : "Perempuan"}
                  </span>
                </div>

                <div className="text-[#65676B] flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-[#050505]">{formatRupiah(v.price)}</span>
                  <span>·</span>
                  <span>{sizes.length > 0 ? `Ukuran: ${sizes.join(", ")}` : "Tanpa ukuran (meter)"}</span>
                  <span>·</span>
                  <span>Tahun Ajaran: {v.academicYear}</span>
                </div>

                <div className="text-xs text-[#65676B] pt-0.5">
                  <span className="font-medium text-[#050505]">Stok Gudang:</span>{" "}
                  {stock.length > 0
                    ? stock.map((s) => `${s.size || "-"}: ${s.quantity}`).join(" | ")
                    : "0"}
                  <span className="ml-1.5 font-semibold text-[#1877F2]">({totalStock} total)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onEdit(vRow)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#CED0D4] bg-white rounded-lg text-xs font-semibold text-[#050505] hover:bg-[#F0F2F5] active:scale-[0.98] transition-all shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#65676B]" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
