import { useState } from "react";
import { RotateCcw, Plus, PackageCheck } from "lucide-react";
import type { VendorReturn } from "./vendor-returns-types";
import { formatRupiah } from "../../lib/transfer-pricing";

interface VendorReturnsSectionProps {
  returns: VendorReturn[];
  isLoading: boolean;
  onOpenCreate: () => void;
}

export function VendorReturnsSection({
  returns,
  isLoading,
  onOpenCreate,
}: VendorReturnsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] overflow-hidden shadow-xs">
      <div className="p-4 sm:p-5 border-b border-[#E4E6EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8F9FA]/50">
        <div>
          <h3 className="text-sm font-bold text-[#050505] flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-600" />
            <span>Retur ke Supplier (Vendor Returns)</span>
          </h3>
          <p className="text-xs text-[#65676B] mt-0.5">
            Daftar pengembalian buku cacat/rusak ke vendor & pencatatan nota kredit.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreate}
          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Buat Retur Vendor</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-[#65676B]">Memuat data retur vendor...</div>
      ) : returns.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#65676B]">
          Belum ada riwayat retur buku ke supplier.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E4E6EB] bg-[#F8F9FA] text-[#65676B] font-semibold">
                <th className="py-2.5 px-4">No. Dokumen</th>
                <th className="py-2.5 px-4">Supplier</th>
                <th className="py-2.5 px-4">Alasan</th>
                <th className="py-2.5 px-4">Buku Diretur</th>
                <th className="py-2.5 px-4">Credit Note</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EB]">
              {returns.map((ret) => {
                const totalQty = ret.items.reduce((s, it) => s + it.quantity, 0);
                const isExpanded = expandedId === ret.id;

                return (
                  <tr key={ret.id} className="hover:bg-[#F8F9FA]/60">
                    <td className="py-3 px-4 font-mono font-bold text-[#050505]">
                      {ret.returnNumber}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#050505]">
                      {ret.supplierName}
                    </td>
                    <td className="py-3 px-4 text-[#65676B]">{ret.reason}</td>
                    <td className="py-3 px-4 font-medium text-[#050505]">
                      {totalQty} eks ({ret.items.length} judul)
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-700">
                      {formatRupiah(ret.creditNoteAmount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <PackageCheck className="w-3 h-3" />
                        <span>Selesai</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : ret.id)}
                        className="text-xs text-[#1877F2] font-semibold hover:underline"
                      >
                        {isExpanded ? "Tutup" : "Detail"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {expandedId && (
        <div className="p-4 bg-[#F8F9FA] border-t border-[#E4E6EB]">
          {(() => {
            const current = returns.find((r) => r.id === expandedId);
            if (!current) return null;
            return (
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#050505]">
                  Rincian Buku ({current.returnNumber}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {current.items.map((it) => (
                    <div
                      key={it.id}
                      className="p-2.5 bg-white border border-[#CED0D4] rounded-lg text-xs"
                    >
                      <div className="font-semibold text-[#050505]">{it.bookTitle}</div>
                      <div className="text-[11px] text-[#65676B]">
                        ISBN: {it.isbn} &bull; Qty: {it.quantity} eks
                        {it.reason ? ` &bull; ${it.reason}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
