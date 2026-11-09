import { AlertTriangle, RefreshCw, PlusCircle, X } from "lucide-react";
import type { PendingOrderSummary } from "./portal-api";
import { formatRupiah } from "../../lib/transfer-pricing";

interface PendingOrderConfirmModalProps {
  order: PendingOrderSummary;
  kind: "buku" | "seragam";
  onReplace: () => void;
  onKeepAndAdd: () => void;
  onCancel: () => void;
}

export function PendingOrderConfirmModal({
  order,
  kind,
  onReplace,
  onKeepAndAdd,
  onCancel,
}: PendingOrderConfirmModalProps) {
  const isBook = kind === "buku";
  const itemLabel = isBook ? "buku" : "seragam";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E4E6EB] space-y-5 animate-in fade-in zoom-in duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFF7E6] border border-[#FFD966] flex items-center justify-center text-[#B7791F] shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#050505]">
                Pesanan {isBook ? "Buku" : "Seragam"} Gantung Terdeteksi
              </h3>
              <p className="text-xs text-[#65676B]">
                Murid ini sudah memiliki pesanan yang belum diselesaikan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#65676B] hover:text-[#050505] p-1 rounded-lg hover:bg-[#F0F2F5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-[#F7F8FA] rounded-xl border border-[#E4E6EB] space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[#65676B]">No. Pesanan:</span>
            <span className="font-mono font-bold text-[#050505]">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#65676B]">Total Tagihan:</span>
            <span className="font-semibold text-[#050505]">{formatRupiah(order.totalAmount)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#65676B]">Sudah Terbayar:</span>
            <span className="font-semibold text-[#31A24C]">{formatRupiah(order.paidAmount)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#65676B]">Status:</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
              {order.paymentStatus}
            </span>
          </div>
        </div>

        <div className="text-xs text-[#65676B] leading-relaxed">
          Pilih <strong>Ganti Pesanan Lama</strong> jika ada revisi program / ukuran / paket. Pembayaran lama akan dialihkan otomatis dan kelebihan dana diterbitkan refund slip. Atau pilih <strong>Pesanan Baru Terpisah</strong> jika ingin menambah {itemLabel} baru.
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={onReplace}
            className="flex-1 px-4 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Ganti Pesanan Lama</span>
          </button>
          <button
            type="button"
            onClick={onKeepAndAdd}
            className="flex-1 px-4 py-2.5 bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#050505] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Buat Pesanan Baru</span>
          </button>
        </div>
      </div>
    </div>
  );
}
