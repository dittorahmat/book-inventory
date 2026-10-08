import { useCallback, useEffect, useState } from "react";
import { X, ScanLine, Loader2 } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { buildQuery, getJson } from "../../lib/api";
import { effectiveBookPrice } from "../../lib/book-pricing";

interface PhysicalItem {
  id: string;
  barcode: string;
  condition: string;
  status: string;
  notes?: string | null;
  book?: { id: string; title: string; isbn: string; price?: number; buyPrice?: number; sellPrice?: number } | null;
  school?: { id: string; name: string } | null;
}

interface PhysicalDrilldownProps {
  open: boolean;
  schoolId: string;
  bookId?: string;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  in_stock: "Tersedia",
  in_transit: "Dalam transit",
  disposed: "Terbundel",
  lost: "Hilang",
};

/**
 * Drill-down barcode per eksemplar. Hanya dibuka untuk peran gudang/central
 * sebagai alat audit, bukan alur utama (spec: inventory-summary).
 */
export function PhysicalDrilldown({ open, schoolId, bookId, onClose }: PhysicalDrilldownProps) {
  const [items, setItems] = useState<PhysicalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!open || !schoolId) return;
    setIsLoading(true);
    setError(null);
    try {
      const rows = await getJson<PhysicalItem[]>(
        buildQuery("/api/book-items", { schoolId, bookId }),
        "Gagal memuat rincian fisik."
      );
      setItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat rincian fisik.");
    } finally {
      setIsLoading(false);
    }
  }, [open, schoolId, bookId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <header className="px-5 py-3.5 border-b border-[#E4E6EB] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ScanLine className="w-4 h-4 text-[#65676B] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#050505]">Rincian Fisik per Barcode</h3>
              <p className="text-[11px] text-[#65676B] truncate">Alat audit untuk gudang &amp; pusat</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Tutup"
            className="p-1.5 rounded-lg hover:bg-[#F0F2F5] text-[#65676B] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#65676B]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memuat rincian fisik...</span>
            </div>
          ) : error ? (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-[#65676B] text-center py-8">Tidak ada eksemplar fisik di lokasi ini.</p>
          ) : (
            <ul className="divide-y divide-[#E4E6EB] border border-[#E4E6EB] rounded-xl">
              {items.map((item) => {
                const price = item.book ? effectiveBookPrice(item.book).sell : 0;
                return (
                  <li key={item.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] font-bold text-[#1877F2]">{item.barcode}</div>
                      <div className="text-[11px] text-[#65676B] truncate">{item.book?.title ?? "-"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[#65676B]">
                        {STATUS_LABEL[item.status] ?? item.status} &bull; {item.condition}
                      </div>
                      <div className="font-semibold text-[#050505]">{formatRupiah(price)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
