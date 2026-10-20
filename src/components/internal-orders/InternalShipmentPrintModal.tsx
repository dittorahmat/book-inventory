import { Printer, X } from "lucide-react";
import type { InternalShipment } from "../../lib/internal-orders-types";

interface InternalShipmentPrintModalProps {
  shipment: InternalShipment;
  poNumber?: string | null;
  destinationSchoolName?: string | null;
  onClose: () => void;
}

/** Tampilan cetak dokumen Surat Jalan Pengiriman Internal */
export function InternalShipmentPrintModal({
  shipment,
  poNumber,
  destinationSchoolName,
  onClose,
}: InternalShipmentPrintModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 print:static print:bg-white print:p-0" role="dialog" aria-modal="true">
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#E4E6EB] bg-white p-6 shadow-2xl print:max-w-none print:border-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-[#E4E6EB] pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl bg-[#1877F2] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#166FE5] active:scale-[0.98]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Cetak / PDF</span>
            </button>
            <span className="text-xs text-[#65676B]">Pratinjau Surat Jalan</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#CED0D4] p-1.5 text-[#65676B] hover:bg-[#F0F2F5] active:scale-[0.98]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex items-start justify-between border-b-2 border-[#050505] pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#65676B]">Gudang Pusat Logistik</span>
              <h2 className="text-xl font-black text-[#050505]">SURAT JALAN INTERNAL</h2>
              <p className="text-xs text-[#65676B]">Pengiriman Distribusi Buku ke Cabang</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold text-[#050505]">{shipment.deliveryNoteNumber}</p>
              <p className="text-[#65676B]">Tanggal: {shipment.shippedDate ?? shipment.createdAt.slice(0, 10)}</p>
              <p className="mt-1 font-semibold text-emerald-700">Status: {shipment.status.toUpperCase()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#E4E6EB] bg-[#F8F9FA] p-3 text-xs">
            <div>
              <span className="font-semibold text-[#65676B]">Tujuan Cabang:</span>
              <p className="text-sm font-bold text-[#050505]">{destinationSchoolName ?? "Cabang Sekolah"}</p>
            </div>
            <div>
              <span className="font-semibold text-[#65676B]">Referensi PO:</span>
              <p className="text-sm font-bold text-[#050505]">
                {poNumber ? poNumber : <span className="font-normal italic text-[#65676B]">Pengiriman Bebas (Tanpa PO)</span>}
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#050505]">Rincian Barang Dikirim</h3>
            <div className="overflow-hidden rounded-xl border border-[#E4E6EB]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E4E6EB] bg-[#F0F2F5] font-bold text-[#050505]">
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Deskripsi Item / Paket</th>
                    <th className="px-3 py-2 text-center">Tipe</th>
                    <th className="px-3 py-2 text-right">Kuantitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E6EB]">
                  {shipment.items.map((it, idx) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-[#65676B]">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-[#050505]">
                        {it.packageName ?? it.bookTitle ?? "Item Buku"}
                        {it.isOutstandingFollowup && (
                          <span className="ml-1.5 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            Susulan Backorder
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-[#65676B]">{it.packageId ? "Paket" : "Satuan"}</td>
                      <td className="px-3 py-2 text-right font-bold text-[#050505]">{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {shipment.notes && (
            <div className="rounded-xl border border-[#E4E6EB] p-2.5 text-xs">
              <span className="font-bold text-[#65676B]">Catatan: </span>
              <span className="text-[#050505]">{shipment.notes}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
            <div>
              <p className="text-[#65676B]">Pengirim (Gudang Pusat)</p>
              <div className="h-16" />
              <p className="font-bold text-[#050505]">( ........................................ )</p>
            </div>
            <div>
              <p className="text-[#65676B]">Penerima (Staf Cabang)</p>
              <div className="h-16" />
              <p className="font-bold text-[#050505]">( ........................................ )</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
