import { CheckCircle2 } from "lucide-react";
import type { SupplierProcessedItem } from "./SupplierMappingModal";

interface SupplierMappingDoneStepProps {
  booksMatched: number;
  totalSheetsProcessed: number;
  newLinksCount: number;
  suppliersUpserted: number;
  processedSuppliers?: SupplierProcessedItem[];
}

export function SupplierMappingDoneStep({
  booksMatched,
  totalSheetsProcessed,
  newLinksCount,
  suppliersUpserted,
  processedSuppliers,
}: SupplierMappingDoneStepProps) {
  return (
    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-3">
      <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <span>Pemetaan Berhasil Disimpan & Diterapkan!</span>
      </div>
      <p className="text-[11px] text-emerald-900 leading-relaxed">
        Sebanyak <strong>{booksMatched} buku</strong> berhasil terpetakan dari <strong>{totalSheetsProcessed} sheet vendor</strong> ({newLinksCount} relasi buku baru). Terdapat <strong>{suppliersUpserted} supplier baru</strong> yang berhasil didaftarkan.
      </p>
      {processedSuppliers && processedSuppliers.length > 0 && (
        <div className="pt-2 border-t border-emerald-200/60 max-h-48 overflow-y-auto space-y-1">
          {processedSuppliers.map((s, idx) => (
            <div key={`${s.code}-${idx}`} className="p-2 bg-white/80 rounded-lg text-[10px] flex items-center justify-between border border-emerald-100">
              <div>
                <span className="font-mono font-bold text-[#1877F2] mr-1.5">{s.code}</span>
                <span className="font-semibold text-gray-900">{s.name}</span>
                <span className="text-gray-600 block">
                  {[s.contactPerson, s.phone].filter(Boolean).join(" · ") || "Kontak belum dilengkapi"}
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                Sheet: {s.sheet}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
