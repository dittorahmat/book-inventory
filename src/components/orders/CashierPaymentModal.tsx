import { useState } from "react";
import { X } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { postJson } from "../../lib/api";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import { validateRequiredText } from "../../lib/form-validation";
import { allocationViolation } from "../../lib/order-allocation";
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [attempted, setAttempted] = useState(false);

  const remaining = Math.max(0, order.totalAmount - order.paidAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    const errors: Record<string, string | undefined> = {};

    if (transferAmount <= 0) {
      errors.transferAmount = "Nominal struk transfer harus lebih dari Rp 0.";
    }

    const violation = allocationViolation({
      allocationAmount: bookAllocation,
      transferAmount,
      billAmount: order.totalAmount,
    });
    if (violation === "below_minimum") {
      errors.bookAllocation = "Alokasi khusus untuk buku minimal Rp 1.";
    } else if (violation === "above_bill") {
      errors.bookAllocation = `Alokasi buku tidak boleh melebihi total tagihan (${formatRupiah(order.totalAmount)}).`;
    } else if (violation === "above_receipt") {
      errors.bookAllocation = "Alokasi buku tidak boleh melebihi nominal transfer di struk.";
    }

    const bankCheck = validateRequiredText(bankName, "Nama Bank", 2);
    if (!bankCheck.valid) errors.bankName = bankCheck.message;

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await postJson(
        `/api/payments/orders/${order.id}/pay`,
        {
          transferAmount,
          bookAllocationAmount: bookAllocation,
          bankName: bankName.trim(),
          referenceNumber: refNo.trim() || undefined,
        },
        "Gagal mencatat pembayaran"
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mencatat pembayaran");
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
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 text-xs">
          {errorMsg && <div className="text-red-600 bg-red-50 p-2.5 rounded-xl font-medium">{errorMsg}</div>}
          <FormSummaryAlert errors={attempted ? fieldErrors : {}} />
          <div>
            <span className="text-[#65676B]">Murid:</span>{" "}
            <span className="font-bold text-[#050505]">{order.studentName}</span>
          </div>
          <div className="flex justify-between bg-[#F0F2F5] p-3 rounded-xl">
            <span>Total Tagihan: {formatRupiah(order.totalAmount)}</span>
            <span className="font-bold text-[#1877F2]">
              Sisa: {formatRupiah(remaining)}
            </span>
          </div>
          <div>
            <label className="block font-semibold mb-1">
              Nominal Struk Transfer Bank (Rp) <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              placeholder="0"
              value={transferAmount === 0 ? "" : transferAmount}
              onChange={(e) => {
                setTransferAmount(parseInt(e.target.value) || 0);
                if (attempted) setFieldErrors((prev) => ({ ...prev, transferAmount: undefined }));
              }}
              className={`w-full px-3 py-2 border rounded-xl font-semibold transition-colors ${
                attempted && fieldErrors.transferAmount
                  ? "border-rose-500 ring-1 ring-rose-200"
                  : "border-[#CED0D4]"
              }`}
            />
            <FormFieldFeedback error={attempted ? fieldErrors.transferAmount : undefined} />
          </div>
          <div>
            <label className="block font-semibold mb-1">
              Alokasi Khusus untuk Buku Ini (Rp) <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              placeholder="0"
              value={bookAllocation === 0 ? "" : bookAllocation}
              onChange={(e) => {
                setBookAllocation(parseInt(e.target.value) || 0);
                if (attempted) setFieldErrors((prev) => ({ ...prev, bookAllocation: undefined }));
              }}
              className={`w-full px-3 py-2 border rounded-xl font-bold text-[#1877F2] transition-colors ${
                attempted && fieldErrors.bookAllocation
                  ? "border-rose-500 ring-1 ring-rose-200"
                  : "border-[#CED0D4]"
              }`}
            />
            <FormFieldFeedback error={attempted ? fieldErrors.bookAllocation : undefined} />
          </div>
          <div>
            <label className="block font-semibold mb-1">
              Bank <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => {
                setBankName(e.target.value);
                if (attempted) setFieldErrors((prev) => ({ ...prev, bankName: undefined }));
              }}
              className={`w-full px-3 py-2 border rounded-xl transition-colors ${
                attempted && fieldErrors.bankName
                  ? "border-rose-500 ring-1 ring-rose-200"
                  : "border-[#CED0D4]"
              }`}
            />
            <FormFieldFeedback error={attempted ? fieldErrors.bankName : undefined} />
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
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? "Menyimpan..." : "Verifikasi & Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
