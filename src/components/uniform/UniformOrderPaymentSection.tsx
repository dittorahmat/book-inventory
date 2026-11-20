import type { UseUniformOrderReturn } from "./useUniformOrder";

interface UniformOrderPaymentSectionProps {
  order: UseUniformOrderReturn;
}

export function UniformOrderPaymentSection({ order }: UniformOrderPaymentSectionProps) {
  if (order.orderType !== "regular") return null;

  return (
    <div className="space-y-3 pt-2 border-t border-[#E4E6EB]">
      <h3 className="text-xs font-bold text-[#050505] uppercase tracking-wider">Konfirmasi Pembayaran Bank</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">Bank Tujuan Transfer</label>
          <select
            value={order.bankName}
            onChange={(e) => order.setBankName(e.target.value)}
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white"
          >
            <option value="BCA">BCA (Yayasan Al-Wildan)</option>
            <option value="Mandiri">Mandiri (Yayasan Al-Wildan)</option>
            <option value="BSI">BSI (Yayasan Al-Wildan)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">Tanggal Transfer Bank</label>
          <input
            type="date"
            value={order.transferDate}
            onChange={(e) => order.setTransferDate(e.target.value)}
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">Nomor Referensi Transaksi (Opsional)</label>
          <input
            type="text"
            value={order.referenceNumber}
            onChange={(e) => order.setReferenceNumber(e.target.value)}
            placeholder="Contoh: REF9821421 / No Struk"
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">Upload Bukti Transfer Bank (Opsional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onloadend = () => order.setPaymentProof(reader.result as string);
              reader.readAsDataURL(file);
            }}
            className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#1877F2] file:text-white"
          />
          {order.paymentProof && (
            <p className="mt-1 text-[11px] font-semibold text-emerald-600">✓ Bukti transfer telah terlampir</p>
          )}
        </div>
      </div>
    </div>
  );
}
