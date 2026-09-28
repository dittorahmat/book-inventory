import { CreditCard, Award, CheckCircle2 } from "lucide-react";
import type {
  BookPackageOption,
  FileUploadHandler,
} from "../../lib/portal-types";

interface PaymentStepProps {
  pkg: BookPackageOption;
  orderType: "regular" | "scholarship";
  setOrderType: (val: "regular" | "scholarship") => void;
  scholarshipProofBase64: string;
  setScholarshipProofBase64: (val: string) => void;
  paymentChoice: "full" | "partial";
  setPaymentChoice: (val: "full" | "partial") => void;
  transferAmount: number;
  setTransferAmount: (val: number) => void;
  bookAllocationAmount: number;
  setBookAllocationAmount: (val: number) => void;
  bankName: string;
  setBankName: (val: string) => void;
  referenceNumber: string;
  setReferenceNumber: (val: string) => void;
  setPaymentProofBase64: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
  isSubmitting: boolean;
  onFileUpload: FileUploadHandler;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function PaymentStep({
  pkg,
  orderType,
  setOrderType,
  scholarshipProofBase64,
  setScholarshipProofBase64,
  paymentChoice,
  setPaymentChoice,
  transferAmount,
  setTransferAmount,
  bookAllocationAmount,
  setBookAllocationAmount,
  bankName,
  setBankName,
  referenceNumber,
  setReferenceNumber,
  setPaymentProofBase64,
  notes,
  setNotes,
  isSubmitting,
  onFileUpload,
  onBack,
  onSubmit,
}: PaymentStepProps) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E4E6EB] shadow-xs space-y-6">
      <div className="border-b border-[#E4E6EB] pb-4">
        <div className="text-xs font-bold text-[#1877F2] uppercase tracking-wider">Jalur Pendaftaran & Pembayaran</div>
        <h2 className="text-base font-bold text-[#050505]">
          Pilih Jalur: Reguler atau Beasiswa
        </h2>
        <p className="text-xs text-[#65676B] mt-0.5">
          Paket: <span className="font-semibold text-[#050505]">{pkg.name}</span> (Normal: Rp {pkg.price.toLocaleString("id-ID")})
        </p>
      </div>

      {/* Radio Order Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          onClick={() => setOrderType("regular")}
          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
            orderType === "regular"
              ? "border-[#1877F2] bg-[#E7F3FF]/40"
              : "border-[#E4E6EB] bg-white hover:border-[#CED0D4]"
          }`}
        >
          <CreditCard className="w-5 h-5 text-[#1877F2] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-xs text-[#050505]">Jalur Reguler</div>
            <div className="text-[11px] text-[#65676B] mt-0.5">
              Pembayaran transfer bank (bisa lunas atau dicicil parsial).
            </div>
          </div>
        </div>

        <div
          onClick={() => setOrderType("scholarship")}
          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
            orderType === "scholarship"
              ? "border-emerald-600 bg-emerald-50/50"
              : "border-[#E4E6EB] bg-white hover:border-[#CED0D4]"
          }`}
        >
          <Award className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-xs text-[#050505]">Jalur Beasiswa (Diskon 100%)</div>
            <div className="text-[11px] text-[#65676B] mt-0.5">
              Bebas biaya 100% dengan melampirkan foto surat tanda beasiswa.
            </div>
          </div>
        </div>
      </div>

      {/* JALUR BEASISWA DETAILS */}
      {orderType === "scholarship" && (
        <div className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
            <Award className="w-4 h-4 text-emerald-600" />
            Upload Surat Tanda Beasiswa
          </div>
          <p className="text-xs text-emerald-700">
            Total Tagihan Buku: <span className="font-bold">Rp 0 (Diskon 100%)</span>. Pihak sekolah akan memverifikasi dokumen sebelum paket buku diserahkan.
          </p>

          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1.5">
              Foto Surat / Kartu Beasiswa (Wajib)
            </label>
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => onFileUpload(e, setScholarshipProofBase64)}
              className="w-full text-xs text-[#65676B] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
            />
          </div>

          {scholarshipProofBase64 && (
            <div className="mt-2">
              <span className="text-[11px] font-semibold text-emerald-800">Preview Lampiran Dokumen:</span>
              <img
                src={scholarshipProofBase64}
                alt="Scholarship proof"
                className="mt-1 h-32 rounded-xl object-contain border border-emerald-300 bg-white p-1"
              />
            </div>
          )}
        </div>
      )}

      {/* JALUR REGULER DETAILS */}
      {orderType === "regular" && (
        <div className="space-y-4 p-5 bg-[#F7F8FA] border border-[#E4E6EB] rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#050505]">Rencana Pembayaran</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentChoice("full");
                  setBookAllocationAmount(pkg.price);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  paymentChoice === "full" ? "bg-[#1877F2] text-white" : "bg-white text-[#65676B] border border-[#CED0D4]"
                }`}
              >
                Bayar Lunas
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentChoice("partial");
                  setBookAllocationAmount(Math.round(pkg.price / 2));
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  paymentChoice === "partial" ? "bg-[#1877F2] text-white" : "bg-white text-[#65676B] border border-[#CED0D4]"
                }`}
              >
                Cicilan (Parsial)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Bank Tujuan Transfer
              </label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
              >
                <option value="BCA">BCA (Yayasan Al Wildan - 882019283)</option>
                <option value="Mandiri">Mandiri (Yayasan Al Wildan - 164000293)</option>
                <option value="BSI">BSI (Yayasan Al Wildan - 772001928)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Nomor Referensi / No. Resi Bank
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Contoh: 981249821 / Ref ATM"
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Total Nominal Struk Bukti Transfer (Rp)
              </label>
              <input
                type="number"
                min={0}
                value={transferAmount}
                onChange={(e) => setTransferAmount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
                placeholder="Total di struk (bisa gabung SPP)"
              />
              <span className="text-[10px] text-[#65676B] block mt-0.5">
                *Isi total transfer di struk jika mentransfer gabungan (SPP + Buku).
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Alokasi Khusus untuk Buku Ini (Rp)
              </label>
              <input
                type="number"
                min={0}
                max={pkg.price}
                value={bookAllocationAmount}
                onChange={(e) => setBookAllocationAmount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-bold text-[#1877F2]"
              />
              <div className="flex justify-between text-[10px] text-[#65676B] mt-0.5">
                <span>Tagihan: Rp {pkg.price.toLocaleString("id-ID")}</span>
                <span>Sisa: Rp {Math.max(0, pkg.price - bookAllocationAmount).toLocaleString("id-ID")}</span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Foto / Screenshot Bukti Transfer
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onFileUpload(e, setPaymentProofBase64)}
                className="w-full text-xs text-[#65676B] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#1877F2] file:text-white hover:file:bg-[#166FE5]"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-[#050505] mb-1">
          Catatan Tambahan (Opsional)
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan untuk bagian administrasi buku sekolah..."
          className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
        />
      </div>

      <div className="pt-4 border-t border-[#E4E6EB] flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-[#F0F2F5] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98] transition-all"
        >
          Kembali
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <span>{isSubmitting ? "Mengirimkan Pesanan..." : "Konfirmasi & Kirim Pesanan"}</span>
          <CheckCircle2 className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
