import { useState } from "react";
import { X } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { postJson } from "../../lib/api";
import type { StudentOrder } from "./order-types";

interface CashierPaymentModalProps {
  order: StudentOrder;
  onClose: () => void;
  onSuccess: () => void;
}

export function CashierPaymentModal({ order, onClose, onSuccess }: CashierPaymentModalProps) {
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [bookAllocation, setBookAllocation] = useState<number>(0);
  const [bankName, setBankName] = useState<string>("BCA");
  const [refNo, setRefNo] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await postJson(
        `/api/payments/orders/${order.id}/pay`,
        {
          transferAmount,
          bookAllocationAmount: bookAllocation,
          bankName,
          referenceNumber: refNo,
        },
        "Gagal mencatat pembayaran"
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mencatat pembayaran");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#050505]">Verifikasi Pembayaran Kasir</h3>
          <button onClick={onClose} className="text-[#65676B] hover:text-[#050505]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && <div className="text-red-600 bg-red-50 p-2 rounded-lg">{errorMsg}</div>}
          <div>
            <span className="text-[#65676B]">Murid:</span>{" "}
            <span className="font-bold text-[#050505]">{order.studentName}</span>
          </div>
          <div className="flex justify-between bg-[#F0F2F5] p-3 rounded-xl">
            <span>Total Tagihan: {formatRupiah(order.totalAmount)}</span>
            <span className="font-bold text-[#1877F2]">
              Sisa: {formatRupiah(Math.max(0, order.totalAmount - order.paidAmount))}
            </span>
          </div>
          <div>
            <label className="block font-semibold mb-1">Nominal Struk Transfer Bank (Rp)</label>
            <input
              type="number"
              required
              placeholder="0"
              value={transferAmount === 0 ? "" : transferAmount}
              onChange={(e) => setTransferAmount(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl font-semibold"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Alokasi Khusus untuk Buku Ini (Rp)</label>
            <input
              type="number"
              required
              placeholder="0"
              value={bookAllocation === 0 ? "" : bookAllocation}
              onChange={(e) => setBookAllocation(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl font-bold text-[#1877F2]"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Bank</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Nomor Referensi Transaksi</label>
            <input
              type="text"
              placeholder="Contoh: REF9821421"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F0F2F5] rounded-xl font-semibold text-[#65676B]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#1877F2] text-white rounded-xl font-semibold"
            >
              {isSubmitting ? "Menyimpan..." : "Verifikasi & Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
