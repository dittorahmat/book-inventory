import { useState } from "react";
import { Send, CheckCircle } from "lucide-react";
import type { TransferShipment } from "../../types";
import { formatRupiah } from "../../lib/transfer-pricing";
import type { BundleConditionPick, LooseConditionPick, ReceiptCondition } from "./useTransfers";

interface ShipmentDetailModalProps {
  shipment: TransferShipment;
  onClose: () => void;
  onDispatch: (id: string) => void;
  onReceive: (shipment: TransferShipment, loosePicks?: LooseConditionPick[], bundlePicks?: BundleConditionPick[]) => void;
}

const RECEIPT_OPTIONS: Array<{ value: ReceiptCondition; label: string }> = [
  { value: "good", label: "Baik" },
  { value: "damaged", label: "Rusak" },
  { value: "missing", label: "Hilang" },
];

/** Rincian manifest + aksi dispatch/receive satu shipment. Murni presentasi. */
export function ShipmentDetailModal({ shipment, onClose, onDispatch, onReceive }: ShipmentDetailModalProps) {
  const [conditions, setConditions] = useState<Record<string, ReceiptCondition>>({});
  const isReceivable = shipment.status === "in_transit";
  const pickFor = (key: string): ReceiptCondition => conditions[key] ?? "good";
  const setPick = (key: string, value: ReceiptCondition) =>
    setConditions((prev) => ({ ...prev, [key]: value }));
  const flaggedCount = Object.values(conditions).filter((c) => c !== "good").length;

  const handleConfirmReceive = () => {
    const loosePicks: LooseConditionPick[] = (shipment.items || [])
      .filter((item) => item.itemType !== "package" && item.bookItemId)
      .map((item) => ({ bookItemId: item.bookItemId as string, condition: pickFor(`loose:${item.bookItemId}`) }));
    const bundlePicks: BundleConditionPick[] = (shipment.items || [])
      .filter((item) => item.itemType === "package" && item.packageItemId)
      .map((item) => ({ packageItemId: item.packageItemId as string, condition: pickFor(`pkg:${item.packageItemId}`) }));
    onReceive(shipment, loosePicks, bundlePicks);
  };
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#CED0D4] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E4E6EB] pb-3">
          <div>
            <div className="font-bold text-lg text-[#050505]">{shipment.shipmentNumber}</div>
            <div className="text-xs text-[#65676B] font-semibold mt-0.5">
              {shipment.fromSchool?.name} &rarr; {shipment.toSchool?.name}
            </div>
            {shipment.reason && (
              <div className="text-xs text-[#050505] mt-1 bg-[#F0F2F5] px-2.5 py-1 rounded-md">
                <span className="text-[#65676B] font-semibold">Alasan:</span> {shipment.reason}
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E7F3FF] text-[#1877F2] uppercase">
            {shipment.status}
          </span>
        </div>

        <div>
          <div className="text-xs font-bold text-[#65676B] mb-1.5">
            Manifest Items ({shipment.items?.length || 0}) - harga saat kirim
          </div>
          <div className="divide-y divide-[#E4E6EB] border border-[#E4E6EB] rounded-xl max-h-48 overflow-y-auto text-xs bg-[#F0F2F5]">
            {shipment.items?.map((item) => (
              <div key={item.id} className="p-2.5 flex justify-between items-center gap-2 bg-white first:rounded-t-xl last:rounded-b-xl">
                <div className="min-w-0">
                  <div className="font-mono font-bold text-xs text-[#1877F2] flex items-center gap-1.5 flex-wrap">
                    <span>{item.barcode}</span>
                    {item.itemType === "package" && (
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                        Paket
                      </span>
                    )}
                    {item.condition && (
                      <span
                        className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase ${
                          item.condition === "damaged"
                            ? "bg-red-50 text-[#FA383E] border border-red-200"
                            : item.condition === "new"
                            ? "bg-emerald-50 text-[#31A24C] border border-emerald-200"
                            : "bg-[#F0F2F5] text-[#65676B] border border-[#CED0D4]"
                        }`}
                      >
                        {item.condition}
                      </span>
                    )}
                  </div>
                  <div className="text-[#050505] font-medium text-xs">{item.bookTitle}</div>
                  <div className="text-[11px] font-bold text-[#1877F2]">
                    {formatRupiah(item.unitPriceSnapshot || 0)}
                    {(item.quantity || 1) > 1 ? ` x ${item.quantity} = ${formatRupiah(item.lineTotal || 0)}` : ""}
                  </div>
                </div>
                {item.receivedCondition && (
                  <span className="text-[10px] font-bold text-[#65676B] bg-[#F0F2F5] px-2 py-0.5 rounded-full border border-[#CED0D4] shrink-0">
                    Diterima: {item.receivedCondition}
                  </span>
                )}
                {isReceivable && !item.receivedCondition && (
                  <label className="flex flex-col gap-0.5 shrink-0">
                    <span className="text-[9px] font-bold uppercase text-[#65676B]">Kondisi terima</span>
                    <select
                      aria-label={`Kondisi terima ${item.barcode}`}
                      value={pickFor(`${item.itemType === "package" ? "pkg:" : "loose:"}${item.itemType === "package" ? item.packageItemId : item.bookItemId}`)}
                      onChange={(e) =>
                        setPick(
                          `${item.itemType === "package" ? "pkg:" : "loose:"}${item.itemType === "package" ? item.packageItemId : item.bookItemId}`,
                          e.target.value as ReceiptCondition
                        )
                      }
                      className="text-[11px] font-semibold border border-[#CED0D4] rounded-lg px-1.5 py-1 bg-white text-[#050505] focus:outline-none focus:border-[#1877F2]"
                    >
                      {RECEIPT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 bg-[#E7F3FF] px-3 py-2 rounded-xl border border-[#1877F2]/20 text-xs">
            <span className="font-bold text-[#050505]">Total Nilai</span>
            <span className="font-bold text-[#1877F2]">{formatRupiah(shipment.totalDeclaredValue || 0)}</span>
          </div>
        </div>

        <div className="flex gap-2.5 justify-end pt-3 border-t border-[#E4E6EB]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] transition-colors"
          >
            Tutup
          </button>

          {shipment.status === "draft" && (
            <button
              onClick={() => onDispatch(shipment.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Dispatch Pengiriman
            </button>
          )}

          {shipment.status === "in_transit" && (
            <div className="flex flex-col gap-1.5 items-end">
              {flaggedCount > 0 && (
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                  {flaggedCount} item ditandai rusak/hilang &rarr; status selisih
                </span>
              )}
              <button
                onClick={handleConfirmReceive}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#31A24C] hover:bg-[#2B8F42] text-white rounded-lg transition-colors shadow-sm active:scale-[0.98]"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Konfirmasi Penerimaan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
