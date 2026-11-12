import { Boxes, Package } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { isWprBook } from "../../lib/wpr";
import { QuickSetStockButton } from "./QuickSetStockButton";
import type { LooseSummaryRow, PackageSummaryRow } from "../../types/stock-summary";

interface StockSummaryTableProps {
  looseRows: LooseSummaryRow[];
  packageRows: PackageSummaryRow[];
  quantities: Record<string, number>;
  onQuantityChange: (key: string, value: number) => void;
  isDemoMode?: boolean;
  schoolId?: string;
  onStockOverridden?: () => void;
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
  isDemoMode,
  schoolId,
  onStockOverridden,
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
                  const isWpr = isWprBook({ id: row.bookId, title: row.title, isbn: row.isbn });
                  return (
                    <tr key={row.bookId} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-[#050505]">
                          <span>{row.title}</span>
                          {isWpr && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              Layanan Non-Fisik
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#65676B] font-mono">{row.isbn}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-bold text-[#1877F2] text-sm">{row.availableQty}</span>
                          <span className="text-[#65676B]"> / {row.totalQty}</span>
                          {isDemoMode && schoolId && onStockOverridden && (
                            <QuickSetStockButton
                              label={row.title}
                              currentQuantity={row.availableQty}
                              overrideEndpoint="/api/demo/stock/book-override"
                              payload={{ schoolId, bookId: row.bookId }}
                              onSuccess={onStockOverridden}
                            />
                          )}
                        </div>
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
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            min={0}
                            max={row.availableQty}
                            placeholder="0"
                            value={(quantities[key] ?? 0) === 0 ? "" : quantities[key]}
                            onChange={(e) =>
                              onQuantityChange(key, Math.max(0, Math.min(row.availableQty, Number(e.target.value) || 0)))
                            }
                            className={inputClass}
                            aria-label={`Jumlah pindah ${row.title}`}
                          />
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
              const isWpr = isWprBook({ id: row.bookId, title: row.title, isbn: row.isbn });
              return (
                <li key={row.bookId} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-[#050505] truncate">
                      <span className="truncate">{row.title}</span>
                      {isWpr && (
                        <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          Non-Fisik
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#65676B]">
                      {row.availableQty} tersedia &bull; {formatRupiah(row.sellPrice)}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={row.availableQty}
                    placeholder="0"
                    value={(quantities[key] ?? 0) === 0 ? "" : quantities[key]}
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
                    <div className="text-[11px] text-[#65676B] mt-0.5 flex items-center gap-1.5">
                      <span>{row.readyQty} siap &bull; {row.totalQty} total &bull; {formatRupiah(row.price)}</span>
                      {isDemoMode && schoolId && onStockOverridden && (
                        <QuickSetStockButton
                          label={row.name}
                          currentQuantity={row.readyQty}
                          overrideEndpoint="/api/demo/stock/package-override"
                          payload={{ schoolId, packageId: row.packageId }}
                          onSuccess={onStockOverridden}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={row.readyQty}
                      placeholder="0"
                      value={(quantities[key] ?? 0) === 0 ? "" : quantities[key]}
                      onChange={(e) =>
                        onQuantityChange(key, Math.max(0, Math.min(row.readyQty, Number(e.target.value) || 0)))
                      }
                      className={inputClass}
                      aria-label={`Jumlah pindah ${row.name}`}
                    />
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
