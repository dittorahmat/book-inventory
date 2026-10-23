import { CreditCard, Award, CheckCircle2 } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type {
  BookPackageOption,
  FileUploadHandler,
} from "../../lib/portal-types";
import { PackageBreakdown } from "./PackageBreakdown";
import { WprQuestion } from "./WprQuestion";
import { allocationForChoice, draftRemainder, validateAllocation } from "./order-draft";
import type { OrderDraft, OrderDraftActions } from "./useOrderDraft";

interface PaymentStepProps {
  pkg: BookPackageOption;
  draft: OrderDraft;
  actions: OrderDraftActions;
  isSatuan?: boolean;
  wprFee?: number;
  wprLoading?: boolean;
  isSubmitting: boolean;
  onFileUpload: FileUploadHandler;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function PaymentStep({
  pkg,
  draft,
  actions,
  isSatuan,
  wprFee,
  wprLoading,
  isSubmitting,
  onFileUpload,
  onBack,
  onSubmit,
}: PaymentStepProps) {
  const {
    orderType,
    scholarshipProofBase64,
    paymentChoice,
    transferAmount,
    bookAllocationAmount,
    bankName,
    referenceNumber,
    paymentProofBase64,
    financeProofBase64,
    parentPhoneManual,
    notes,
    homeAddress,
    hasTakenPackage,
  } = draft;
  const {
    setOrderType,
    setScholarshipProofBase64,
    setPaymentChoice,
    setTransferAmount,
    setBookAllocationAmount,
    setBankName,
    setReferenceNumber,
    setPaymentProofBase64,
    setFinanceProofBase64,
    setParentPhoneManual,
    setNotes,
    setHomeAddress,
    setHasTakenPackage,
  } = actions;
  const allocationCheck = validateAllocation({
    transferAmount,
    allocationAmount: bookAllocationAmount,
    bookTotal: pkg.price,
  });
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E4E6EB] shadow-xs space-y-6">
      <div className="border-b border-[#E4E6EB] pb-4">
        <div className="text-xs font-bold text-[#1877F2] uppercase tracking-wider">Jalur Pendaftaran & Pembayaran</div>
        <h2 className="text-base font-bold text-[#050505]">
          Pilih Jalur: Reguler atau Beasiswa
        </h2>
        <p className="text-xs text-[#65676B] mt-0.5">
          Paket: <span className="font-semibold text-[#050505]">{pkg.name}</span> (Normal: {formatRupiah(pkg.price)})
        </p>
        {pkg.items.length > 0 && (
          <div className="mt-1 text-left">
            <PackageBreakdown items={pkg.items} />
          </div>
        )}
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
                  setBookAllocationAmount(allocationForChoice("full", pkg.price));
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
                  setBookAllocationAmount(allocationForChoice("partial", pkg.price));
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
              <SearchableSingleSelect
                label="Bank Tujuan Transfer"
                options={[
                  { value: "BCA", label: "BCA", hint: "Yayasan Al Wildan - 882019283" },
                  { value: "Mandiri", label: "Mandiri", hint: "Yayasan Al Wildan - 164000293" },
                  { value: "BSI", label: "BSI", hint: "Yayasan Al Wildan - 772001928" },
                ]}
                value={bankName}
                onChange={setBankName}
                placeholder="Pilih bank..."
              />
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
                value={transferAmount === 0 ? "" : transferAmount}
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
                placeholder="0"
                value={bookAllocationAmount === 0 ? "" : bookAllocationAmount}
                onChange={(e) => setBookAllocationAmount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-bold text-[#1877F2]"
              />
              <div className="flex justify-between text-[10px] text-[#65676B] mt-0.5">
                <span>Tagihan: {formatRupiah(pkg.price)}</span>
                <span>Sisa: {formatRupiah(draftRemainder(pkg.price, bookAllocationAmount))}</span>
              </div>
              {!allocationCheck.ok && (
                <p role="alert" className="mt-1.5 text-[11px] font-semibold text-red-600">
                  {allocationCheck.message}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Nomor WhatsApp Wali Murid (Penerima Bukti Pengambilan) <span className="text-red-500 font-bold">*Wajib</span>
              </label>
              <input
                type="tel"
                required
                value={parentPhoneManual}
                onChange={(e) => setParentPhoneManual(e.target.value)}
                placeholder="Contoh: 081234567890 (Bukti Pengambilan & Kode Unik dikirim ke nomor ini)"
                className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
              />
              <span className="text-[10px] text-[#65676B] block mt-0.5">
                *Wajib diisi nomor WhatsApp aktif yang akan membawa siswa/mengambil buku di cabang.
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Foto / Screenshot Bukti Transfer <span className="text-[#65676B] font-normal">(Wajib jika bayar transfer)</span>
              </label>
              <input
                type="file"
                accept="image/*"
                data-testid="payment-proof-input"
                onChange={(e) => onFileUpload(e, setPaymentProofBase64)}
                className="w-full text-xs text-[#65676B] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#1877F2] file:text-white hover:file:bg-[#166FE5]"
              />
              {paymentProofBase64 && (
                <p className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  ✓ Bukti transfer telah terunggah
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#050505] mb-1">
                Surat Keterangan dari Finance Al Wildan <span className="text-[#65676B] font-normal">(Opsional / Jika ada dispensasi finance)</span>
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                data-testid="finance-proof-input"
                onChange={(e) => onFileUpload(e, setFinanceProofBase64)}
                className="w-full text-xs text-[#65676B] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-800"
              />
              {financeProofBase64 ? (
                <p className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  ✓ Surat Keterangan Finance telah terunggah
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-[#65676B]">
                  *Unggah surat rekomendasi/keterangan dari bagian Finance apabila pembayaran dicicil atau ditunda.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isSatuan && (
        <WprQuestion
          hasTakenPackage={hasTakenPackage ?? null}
          setHasTakenPackage={setHasTakenPackage}
          wprFee={wprFee ?? 0}
          wprLoading={wprLoading ?? false}
        />
      )}

      {isSatuan && (
        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">
            Alamat Rumah (Wajib, buku satuan dikirim ke rumah)
          </label>
          <textarea
            rows={2}
            required
            value={homeAddress ?? ""}
            onChange={(e) => setHomeAddress?.(e.target.value)}
            placeholder="Contoh: Jl. Mawar No. 10, RT 02/RW 05, Bogor 16111"
            className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
          />
          <span className="text-[10px] text-[#65676B] block mt-0.5">
            *Buku satuan diantar ke alamat ini via kurir ekspedisi.
          </span>
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
        {(() => {
          const isMissingProof =
            orderType === "regular"
              ? !paymentProofBase64
              : !scholarshipProofBase64;
          return (
            <button
              type="submit"
              disabled={isSubmitting || isMissingProof || !allocationCheck.ok}
              className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? "Mengirimkan Pesanan..." : "Konfirmasi & Kirim Pesanan"}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          );
        })()}
      </div>
    </form>
  );
}
