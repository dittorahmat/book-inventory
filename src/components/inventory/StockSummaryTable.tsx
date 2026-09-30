import { Boxes, Package, ScanLine } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { LooseSummaryRow, PackageSummaryRow } from "../../types/stock-summary";

interface StockSummaryTableProps {
  looseRows: LooseSummaryRow[];
  packageRows: PackageSummaryRow[];
  quantities: Record<string, number>;
  onQuantityChange: (key: string, value: number) => void;
  canDrilldown: boolean;
  onDrilldown: (bookId?: string) => void;
}

const CONDITION_LABEL: Record<string, string> = {
  new: "Baru",
  good: "Baik",
  fair: "Sedang",
  damaged: "Rusak",
};

const inputClass =
  "w-16 px-2 py-1 bg-white border border-[#CED0D4] rounded-lg text-xs font-bold text-[#1877F2] text-center focus:outline-hidden focus:border-[#1877F2]";

/**
 * Tampilan utama stok: satu baris per judul dan per jenis paket, tanpa
 * daftar barcode (spec: inventory-summary). Kuantitas diisi di sini dan
 * fisiknya dialokasikan server.
 */
export function StockSummaryTable({
  looseRows,
  packageRows,
  quantities,
  onQuantityChange,
  canDrilldown,
  onDrilldown,
}: StockSummaryTableProps) {
  if (looseRows.length === 0 && packageRows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs p-10 text-center">
        <Boxes className="w-8 h-8 text-[#CED0D4] mx-auto mb-2" />
        <p className="text-sm font-bold text-[#050505]">Belum ada stok di lokasi ini</p>
        <p className="text-xs text-[#65676B] mt-1 max-w-md mx-auto">
          Stok satuan muncul setelah penerimaan barang masuk atau transfer dari gudang. Stok paket muncul setelah
          perakitan bundling di gudang.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {looseRows.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
          <header className="px-5 py-3 border-b border-[#E4E6EB] flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#65676B]" />
            <h3 className="text-sm font-bold text-[#050505]">Stok Satuan per Judul</h3>
            <span className="text-[11px] text-[#65676B]">({looseRows.length} judul)</span>
          </header>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F8FA] border-b border-[#E4E6EB] text-[#65676B] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Judul Buku</th>
                  <th className="py-2.5 px-4 text-right">Tersedia</th>
                  <th className="py-2.5 px-4 text-right">Transit</th>
                  <th className="py-2.5 px-4">Kondisi</th>
                  <th className="py-2.5 px-4 text-right">Harga Jual</th>
                  <th className="py-2.5 px-4 text-center">Pindah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E6EB]">
                {looseRows.map((row) => {
                  const key = `loose:${row.bookId}`;
                  return (
                    <tr key={row.bookId} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#050505]">{row.title}</div>
                        <div className="text-[11px] text-[#65676B] font-mono">{row.isbn}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-[#1877F2] text-sm">{row.availableQty}</span>
                        <span className="text-[#65676B]"> / {row.totalQty}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-[#65676B]">{row.inTransitQty}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(row.byCondition)
                            .filter(([, v]) => v > 0)
                            .map(([k, v]) => (
                              <span
                                key={k}
                                className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md border ${
                                  k === "damaged"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-[#F0F2F5] text-[#65676B] border-[#E4E6EB]"
                                }`}
                              >
                                {CONDITION_LABEL[k] ?? k}: {v}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-[#050505]">
                        {formatRupiah(row.sellPrice)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={row.availableQty}
                            value={quantities[key] ?? 0}
                            onChange={(e) =>
                              onQuantityChange(key, Math.max(0, Math.min(row.availableQty, Number(e.target.value) || 0)))
                            }
                            className={inputClass}
                            aria-label={`Jumlah pindah ${row.title}`}
                          />
                          {canDrilldown && (
                            <button
                              type="button"
                              onClick={() => onDrilldown(row.bookId)}
                              title="Lihat rincian fisik (audit)"
                              className="p-1.5 rounded-lg border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors active:scale-[0.98]"
                            >
                              <ScanLine className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden divide-y divide-[#E4E6EB]">
            {looseRows.map((row) => {
              const key = `loose:${row.bookId}`;
              return (
                <li key={row.bookId} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-[#050505] truncate">{row.title}</div>
                    <div className="text-[11px] text-[#65676B]">
                      {row.availableQty} tersedia &bull; {formatRupiah(row.sellPrice)}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={row.availableQty}
                    value={quantities[key] ?? 0}
                    onChange={(e) =>
                      onQuantityChange(key, Math.max(0, Math.min(row.availableQty, Number(e.target.value) || 0)))
                    }
                    className={inputClass}
                    aria-label={`Jumlah pindah ${row.title}`}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {packageRows.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
          <header className="px-5 py-3 border-b border-[#E4E6EB] flex items-center gap-2">
            <Package className="w-4 h-4 text-[#65676B]" />
            <h3 className="text-sm font-bold text-[#050505]">Stok Paket per Jenis</h3>
            <span className="text-[11px] text-[#65676B]">({packageRows.length} jenis)</span>
          </header>

          <ul className="divide-y divide-[#E4E6EB]">
            {packageRows.map((row) => {
              const key = `package:${row.packageId}`;
              return (
                <li key={row.packageId} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-[#1877F2]">{row.code}</span>
                      <span className="text-xs font-bold text-[#050505]">{row.name}</span>
                    </div>
                    <div className="text-[11px] text-[#65676B] mt-0.5">
                      {row.readyQty} siap &bull; {row.totalQty} total &bull; {formatRupiah(row.price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={row.readyQty}
                      value={quantities[key] ?? 0}
                      onChange={(e) =>
                        onQuantityChange(key, Math.max(0, Math.min(row.readyQty, Number(e.target.value) || 0)))
                      }
                      className={inputClass}
                      aria-label={`Jumlah pindah ${row.name}`}
                    />
                    {canDrilldown && (
                      <button
                        type="button"
                        onClick={() => onDrilldown()}
                        title="Lihat rincian fisik (audit)"
                        className="p-1.5 rounded-lg border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors active:scale-[0.98]"
                      >
                        <ScanLine className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
