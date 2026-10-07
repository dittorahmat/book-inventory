import { X } from "lucide-react";
import { calcPoHeader, calcPoLineNet } from "../../lib/book-pricing";
import { PoTotalsSummary } from "./PoTotalsSummary";
import { PoWorkflowActions } from "./PoWorkflowActions";
import { PoSendAction } from "./PoSendAction";
import type { PurchaseOrder } from "./procurement-types";

interface PODetailModalProps {
  po: PurchaseOrder;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onPrint: () => void;
}

/** Modal detail PO: item, tiga angka, bukti TTD, dan aksi alur. */
export function PODetailModal({ po, onClose, onChanged, onPrint }: PODetailModalProps) {
  const header = calcPoHeader(po.items);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <header className="px-5 py-3.5 border-b border-[#E4E6EB] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#050505] font-mono">{po.poNumber}</h3>
            <p className="text-[11px] text-[#65676B]">
              {po.supplierName} &bull; Tujuan: {po.schoolName} &bull; {po.orderDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F0F2F5] text-[#65676B] shrink-0"
            title="Tutup detail"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <div className="divide-y divide-[#E4E6EB] border border-[#E4E6EB] rounded-xl">
            {po.items.map((it) => (
              <div key={it.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-[#050505] truncate">{it.title}</div>
                  <div className="text-[11px] text-[#65676B] font-mono">{it.isbn}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[#65676B]">
                    {it.quantityReceived}/{it.quantityOrdered} eks &times; Rp {it.unitPrice.toLocaleString("id-ID")}
                    {it.discountPercent > 0 ? ` −${it.discountPercent}%` : ""}
                  </div>
                  <div className="font-bold text-[#050505]">
                    Rp {calcPoLineNet(it).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <PoTotalsSummary
            gross={po.subtotalGross ?? header.subtotalGross}
            discount={po.discountTotal ?? header.discountTotal}
            net={po.totalAmount}
            totalQty={po.items.reduce((s, it) => s + it.quantityOrdered, 0)}
          />

          {po.notes && (
            <div>
              <p className="text-xs font-semibold text-[#050505] mb-1">Catatan PO</p>
              <p className="text-xs text-[#65676B] whitespace-pre-wrap">{po.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-[#050505] mb-1.5">Bukti TTD &amp; Cap</p>
            {po.signedDocUrl ? (
              <div className="space-y-1.5">
                <a
                  href={po.signedDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#1877F2] hover:underline inline-flex items-center gap-1"
                >
                  Buka/unduh {po.signedDocName || "berkas bukti"}
                </a>
                {po.signedDocType?.startsWith("image/") && (
                  <img
                    src={po.signedDocUrl}
                    alt={`Bukti tanda tangan ${po.poNumber}`}
                    className="max-w-full h-40 object-contain rounded-xl border border-[#E4E6EB] bg-[#F9FAFB]"
                  />
                )}
                {po.signedDocUploadedAt && (
                  <p className="text-[11px] text-[#65676B]">
                    Diupload: {po.signedDocUploadedAt.slice(0, 19).replace("T", " ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Belum ada berkas bukti. PO harus dicetak, ditandatangani, lalu diupload sebelum dikirim.
              </p>
            )}
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-[#E4E6EB] flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <PoWorkflowActions
            po={po}
            onChanged={onChanged}
            onPrint={onPrint}
          />
          <PoSendAction po={po} onSent={onChanged} />
        </footer>
      </div>
    </div>
  );
}
