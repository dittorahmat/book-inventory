import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { BankTransferReconciliationItem } from "./recon-transfers-types";

interface BankTransferReconciliationTableProps {
  transfers: BankTransferReconciliationItem[];
  onExportExcel: () => void;
  exporting?: boolean;
}

export function BankTransferReconciliationTable({
  transfers,
  onExportExcel,
  exporting,
}: BankTransferReconciliationTableProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transfers;
    return transfers.filter(
      (t) =>
        t.studentName.toLowerCase().includes(q) ||
        t.nis.toLowerCase().includes(q) ||
        t.schoolName.toLowerCase().includes(q) ||
        t.bankName.toLowerCase().includes(q) ||
        (t.referenceNumber && t.referenceNumber.toLowerCase().includes(q))
    );
  }, [transfers, search]);

  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.totalTransfer += r.totalTransfer;
        acc.bookAllocation += r.bookAllocation;
        acc.uniformAllocation += r.uniformAllocation;
        acc.unallocated += r.unallocatedAmount;
        return acc;
      },
      { totalTransfer: 0, bookAllocation: 0, uniformAllocation: 0, unallocated: 0 }
    );
  }, [filtered]);

  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#050505]">Rincian Transfer Bank & Alokasi Order (Finance)</h2>
          <p className="text-xs text-[#65676B]">
            Data rekonsiliasi pembayaran per bukti transfer (pivot Buku & Seragam) untuk validasi mutasi rekening.
          </p>
        </div>
        <button
          type="button"
          onClick={onExportExcel}
          disabled={exporting || transfers.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-emerald-300 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold hover:bg-emerald-100 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <Download className="w-3.5 h-3.5" />
          <span>Ekspor Excel (.xlsx)</span>
        </button>
      </div>

      {/* Ringkasan Metrik Cepat */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <div className="bg-[#F0F2F5]/60 rounded-xl p-3 border border-[#E4E6EB]">
          <div className="text-[11px] font-medium text-[#65676B]">Total Transfer Masuk</div>
          <div className="text-sm font-bold text-[#050505] mt-0.5">{formatRupiah(summary.totalTransfer)}</div>
        </div>
        <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-100">
          <div className="text-[11px] font-medium text-[#1877F2]">Alokasi Buku</div>
          <div className="text-sm font-bold text-[#1877F2] mt-0.5">{formatRupiah(summary.bookAllocation)}</div>
        </div>
        <div className="bg-purple-50/60 rounded-xl p-3 border border-purple-100">
          <div className="text-[11px] font-medium text-purple-700">Alokasi Seragam</div>
          <div className="text-sm font-bold text-purple-700 mt-0.5">{formatRupiah(summary.uniformAllocation)}</div>
        </div>
        <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-100">
          <div className="text-[11px] font-medium text-amber-700">Sisa / Unallocated</div>
          <div className="text-sm font-bold text-amber-700 mt-0.5">{formatRupiah(summary.unallocated)}</div>
        </div>
      </div>

      <div className="pt-2 border-t border-[#E4E6EB]">
        <div className="relative">
          <Search className="w-4 h-4 text-[#65676B] absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama siswa, NIS, sekolah, bank, atau no referensi..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E4E6EB]">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#F0F2F5] text-[#050505] font-semibold border-b border-[#E4E6EB]">
            <tr>
              <th className="px-3.5 py-2.5 whitespace-nowrap">Tgl Transfer</th>
              <th className="px-3 py-2.5">Nama Siswa</th>
              <th className="px-3 py-2.5">NIS</th>
              <th className="px-3 py-2.5">Sekolah</th>
              <th className="px-3 py-2.5">Bank / Ref</th>
              <th className="px-3 py-2.5 text-right whitespace-nowrap">Total Transfer</th>
              <th className="px-3 py-2.5 text-right whitespace-nowrap">Alokasi Buku</th>
              <th className="px-3 py-2.5 text-right whitespace-nowrap">Alokasi Seragam</th>
              <th className="px-3 py-2.5 text-right whitespace-nowrap">Sisa Unallocated</th>
              <th className="px-3 py-2.5 text-center whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[#65676B]">
                  Tidak ada data transfer pada periode terpilih.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.receiptId} className="hover:bg-[#F0F2F5]/40 transition-colors">
                  <td className="px-3.5 py-2.5 whitespace-nowrap text-[#65676B] font-mono">{row.transferDate || "—"}</td>
                  <td className="px-3 py-2.5 font-semibold text-[#050505]">{row.studentName}</td>
                  <td className="px-3 py-2.5 font-mono text-[#65676B]">{row.nis}</td>
                  <td className="px-3 py-2.5">{row.schoolName}</td>
                  <td className="px-3 py-2.5 text-[#65676B]">
                    <div className="font-medium text-[#050505]">{row.bankName}</div>
                    {row.referenceNumber && (
                      <div className="text-[10px] text-[#65676B] truncate max-w-[120px]">{row.referenceNumber}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-[#050505] whitespace-nowrap">
                    {formatRupiah(row.totalTransfer)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#1877F2] whitespace-nowrap">
                    {row.bookAllocation > 0 ? formatRupiah(row.bookAllocation) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-purple-700 whitespace-nowrap">
                    {row.uniformAllocation > 0 ? formatRupiah(row.uniformAllocation) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                    {row.unallocatedAmount > 0 ? (
                      <span className="text-amber-700 font-semibold">{formatRupiah(row.unallocatedAmount)}</span>
                    ) : (
                      <span className="text-[#65676B]">Rp 0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.verificationStatus === "verified"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {row.verificationStatus === "verified" ? "Terverifikasi" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
