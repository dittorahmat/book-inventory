import { BookOpen } from "lucide-react";
import type { SupplierProcessedItem } from "./SupplierMappingModal";

interface SupplierMappingPreviewStepProps {
  totalSheetsProcessed: number;
  totalSuppliers: number;
  totalBooksMatched: number;
  suppliers: SupplierProcessedItem[];
}

export function SupplierMappingPreviewStep({
  totalSheetsProcessed,
  totalSuppliers,
  totalBooksMatched,
  suppliers,
}: SupplierMappingPreviewStepProps) {
  return (
    <div className="space-y-3.5">
      {/* Statistik Ringkas */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 bg-[#F0F2F5] rounded-xl text-center">
          <span className="block text-lg font-bold text-[#050505]">{totalSheetsProcessed}</span>
          <span className="text-[10px] text-[#65676B] font-medium">Sheet Terdeteksi</span>
        </div>
        <div className="p-3 bg-blue-50 rounded-xl text-center">
          <span className="block text-lg font-bold text-[#1877F2]">{totalSuppliers}</span>
          <span className="text-[10px] text-blue-800 font-medium">Supplier Vendor</span>
        </div>
        <div className="p-3 bg-emerald-50 rounded-xl text-center">
          <span className="block text-lg font-bold text-emerald-700">{totalBooksMatched}</span>
          <span className="text-[10px] text-emerald-800 font-medium">Buku Cocok</span>
        </div>
      </div>

      {/* Rincian Tabel Supplier & Kontak */}
      <div>
        <span className="text-xs font-bold text-[#050505] block mb-2">
          Verifikasi Data Supplier & Kontak Yang Akan Diterapkan:
        </span>
        <div className="border border-[#E4E6EB] rounded-xl divide-y divide-[#E4E6EB] max-h-60 overflow-y-auto">
          {suppliers.map((s, idx) => (
            <div key={`${s.code}-${idx}`} className="p-3 hover:bg-[#F9FAFB] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[#1877F2]">{s.code}</span>
                  <span className="text-xs font-bold text-[#050505]">{s.name}</span>
                  {s.isNew && (
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                      BARU
                    </span>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium shrink-0">
                  Sheet: {s.sheet}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-gray-600 flex flex-wrap gap-x-3 gap-y-0.5">
                <span>
                  <strong>Narahubung:</strong> {s.contactPerson || "Belum ada"}
                </span>
                <span>
                  <strong>Telepon:</strong> {s.phone || "Belum ada"}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-gray-500 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-[#1877F2]" />
                <span>
                  {s.booksMatchedCount ?? 0} judul buku cocok
                  {s.sampleBooks && s.sampleBooks.length > 0 && ` (contoh: ${s.sampleBooks.slice(0, 2).join(", ")})`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
        Pemeriksaan selesai. Klik tombol <strong>Simpan & Terapkan Pemetaan</strong> di bawah untuk memasukkan master supplier, kontak narahubung, dan relasi katalog buku ke sistem.
      </div>
    </div>
  );
}
