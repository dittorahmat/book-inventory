import { Plus, Trash2 } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { PackageOption } from "../../lib/internal-orders-types";

export interface ShipmentFormLine {
  id?: string;
  packageId?: string;
  packageName?: string;
  quantity: number;
  maxQuantity?: number;
  isOutstandingFollowup?: boolean;
}

interface ShipmentLinesTableProps {
  mode: "with_po" | "manual";
  lines: ShipmentFormLine[];
  packageCatalog: PackageOption[];
  onAddLine: () => void;
  onUpdateQty: (idx: number, qty: number) => void;
  onSelectPackage: (idx: number, pkgId: string, pkgName?: string) => void;
  onRemoveLine: (idx: number) => void;
}

export function ShipmentLinesTable({
  mode,
  lines,
  packageCatalog,
  onAddLine,
  onUpdateQty,
  onSelectPackage,
  onRemoveLine,
}: ShipmentLinesTableProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[#050505]">
          {mode === "with_po" ? "Item Saran Pengiriman (Editable)" : "Daftar Paket yang Dikirim"}
        </label>
        {mode === "manual" && (
          <button
            type="button"
            onClick={onAddLine}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#1877F2] hover:underline active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah Baris
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#CED0D4] p-4 text-center text-xs text-[#65676B]">
          {mode === "with_po"
            ? "Pilih nomor PO di atas untuk memuat rincian item saran pengiriman."
            : "Belum ada item ditambahkan."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E6EB]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E4E6EB] bg-[#F0F2F5] font-bold text-[#050505]">
              <tr>
                <th className="px-3 py-2">Item Paket</th>
                <th className="w-28 px-3 py-2 text-right">Kuantitas Kirim</th>
                <th className="w-12 px-2 py-2 text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EB]">
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-[#F8F9FA]">
                  <td className="px-3 py-2">
                    {mode === "with_po" ? (
                      <div>
                        <p className="font-semibold text-[#050505]">{line.packageName}</p>
                        {line.maxQuantity !== undefined && (
                          <p className="text-[11px] text-[#65676B]">Sisa terutang: {line.maxQuantity} unit</p>
                        )}
                      </div>
                    ) : (
                      <SearchableSingleSelect
                        options={packageCatalog.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
                        value={line.packageId ?? ""}
                        onChange={(val) => {
                          const found = packageCatalog.find((p) => p.id === val);
                          onSelectPackage(idx, val, found?.name);
                        }}
                        placeholder="-- Pilih Paket --"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => onUpdateQty(idx, Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 rounded-lg border border-[#CED0D4] px-2 py-1 text-right text-xs font-bold text-[#050505] focus:border-[#1877F2] focus:outline-hidden"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveLine(idx)}
                      title="Hapus baris"
                      className="rounded-lg p-1 text-red-500 hover:bg-red-50 active:scale-[0.98]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
