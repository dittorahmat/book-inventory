import { CheckCircle2 } from "lucide-react";

interface OrderSuccessStepProps {
  submittedOrder: any;
  onOrderAnother: () => void;
}

export function OrderSuccessStep({ submittedOrder, onOrderAnother }: OrderSuccessStepProps) {
  return (
    <div className="bg-white rounded-2xl p-7 border border-[#E4E6EB] shadow-xs text-center space-y-4">
      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-6 h-6" />
      </div>

      <h2 className="text-lg font-bold text-[#050505]">Pemesanan Buku Berhasil Didaftarkan!</h2>
      <p className="text-xs text-[#65676B] max-w-md mx-auto">
        Data pemesanan telah tersimpan di sistem sekolah. Konfirmasi dan petunjuk pengambilan fisik telah dicatat.
      </p>

      <div className="bg-[#F7F8FA] p-4 rounded-xl max-w-md mx-auto text-left text-xs space-y-2 border border-[#E4E6EB]">
        <div className="flex justify-between">
          <span className="text-[#65676B]">Nomor Pesanan:</span>
          <span className="font-mono font-bold text-[#050505]">{submittedOrder.order.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#65676B]">Nama Murid:</span>
          <span className="font-semibold text-[#050505]">{submittedOrder.studentName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#65676B]">Paket Buku:</span>
          <span className="font-semibold text-[#050505]">{submittedOrder.packageName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#65676B]">Status Pembayaran:</span>
          <span className="font-bold uppercase tracking-wider text-[#1877F2]">
            {submittedOrder.paymentStatus}
          </span>
        </div>
        <div className="flex justify-between border-t border-[#E4E6EB] pt-2 font-bold">
          <span>Total Tagihan:</span>
          <span>Rp {submittedOrder.totalAmount.toLocaleString("id-ID")}</span>
        </div>
      </div>

      <div className="pt-3 flex justify-center gap-3">
        <button
          onClick={onOrderAnother}
          className="px-5 py-2.5 bg-[#1877F2] active:scale-[0.98] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5] transition-all"
        >
          Pesan untuk Siswa Lain
        </button>
      </div>
    </div>
  );
}
