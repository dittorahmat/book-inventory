import { formatRupiah } from "../../lib/transfer-pricing";
import { draftRemainder } from "./order-draft";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { FormFieldFeedback } from "../ui/FormFieldFeedback";
import type { FileUploadHandler } from "../../lib/portal-types";
import type { OrderDraft, OrderDraftActions } from "./useOrderDraft";

interface RegularPaymentFormProps {
  draft: OrderDraft;
  actions: OrderDraftActions;
  pkgPrice: number;
  allocationCheck: { ok: boolean; message?: string };
  attempted: boolean;
  fieldErrors: Record<string, string | undefined>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string | undefined>>>;
  onFileUpload: FileUploadHandler;
}

export function RegularPaymentForm({
  draft,
  actions,
  pkgPrice,
  allocationCheck,
  attempted,
  fieldErrors,
  setFieldErrors,
  onFileUpload,
}: RegularPaymentFormProps) {
  const {
    paymentChoice,
    transferAmount,
    bookAllocationAmount,
    bankName,
    referenceNumber,
    paymentProofBase64,
    financeProofBase64,
    parentPhoneManual,
  } = draft;
  const { edit, choosePaymentScheme, attachProof } = actions;

  return (
    <div className="space-y-4 p-5 bg-[#F7F8FA] border border-[#E4E6EB] rounded-2xl">
      <div>
        <label className="block text-xs font-semibold text-[#050505] mb-2">
          Skema Pembayaran
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => choosePaymentScheme({ choice: "full", bookTotal: pkgPrice })}
            className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
              paymentChoice === "full"
                ? "border-[#1877F2] bg-[#E7F3FF] text-[#1877F2]"
                : "border-[#CED0D4] bg-white text-[#050505] hover:bg-gray-50"
            }`}
          >
            Lunas Penuh ({formatRupiah(pkgPrice)})
          </button>
          <button
            type="button"
            onClick={() => choosePaymentScheme({ choice: "partial", bookTotal: pkgPrice })}
            className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
              paymentChoice === "partial"
                ? "border-[#1877F2] bg-[#E7F3FF] text-[#1877F2]"
                : "border-[#CED0D4] bg-white text-[#050505] hover:bg-gray-50"
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
            onChange={(value) => {
              edit({ bankName: value });
              if (attempted) {
                setFieldErrors((prev) => ({ ...prev, bankName: undefined }));
              }
            }}
            placeholder="Pilih bank..."
            required
            error={attempted ? fieldErrors.bankName : undefined}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">
            Nomor Referensi / No. Resi Bank
          </label>
          <input
            type="text"
            value={referenceNumber}
            onChange={(e) => edit({ referenceNumber: e.target.value })}
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
            onChange={(e) => edit({ transferAmount: parseInt(e.target.value) || 0 })}
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
            max={pkgPrice}
            placeholder="0"
            value={bookAllocationAmount === 0 ? "" : bookAllocationAmount}
            onChange={(e) => edit({ bookAllocationAmount: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs font-bold text-[#1877F2]"
          />
          <div className="flex justify-between text-[10px] text-[#65676B] mt-0.5">
            <span>Tagihan: {formatRupiah(pkgPrice)}</span>
            <span>Sisa: {formatRupiah(draftRemainder(pkgPrice, bookAllocationAmount))}</span>
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
            value={parentPhoneManual}
            onChange={(e) => {
              edit({ parentPhoneManual: e.target.value });
              if (attempted) {
                setFieldErrors((prev) => ({ ...prev, parentPhoneManual: undefined }));
              }
            }}
            placeholder="Contoh: 081234567890 (Bukti Pengambilan & Kode Unik dikirim ke nomor ini)"
            className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-[#050505] transition-colors ${
              attempted && fieldErrors.parentPhoneManual
                ? "border-rose-500 ring-1 ring-rose-200"
                : "border-[#CED0D4]"
            }`}
          />
          <FormFieldFeedback
            error={attempted ? fieldErrors.parentPhoneManual : undefined}
            hint="*Wajib diisi nomor WhatsApp aktif yang akan membawa siswa/mengambil buku di cabang (10-15 digit)."
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#050505] mb-1">
            Foto / Screenshot Bukti Transfer <span className="text-rose-600">*Wajib</span>
          </label>
          <input
            type="file"
            accept="image/*"
            data-testid="payment-proof-input"
            onChange={(e) => {
              onFileUpload(e, (base64) => {
                attachProof("payment", base64);
                if (attempted) {
                  setFieldErrors((prev) => ({ ...prev, paymentProof: undefined }));
                }
              });
            }}
            className="w-full text-xs text-[#65676B] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#1877F2] file:text-white hover:file:bg-[#166FE5]"
          />
          {paymentProofBase64 && (
            <p className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              ✓ Bukti transfer telah terunggah
            </p>
          )}
          <FormFieldFeedback error={attempted ? fieldErrors.paymentProof : undefined} />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#050505] mb-1">
            Surat Keterangan dari Finance Al Wildan <span className="text-[#65676B] font-normal">(Opsional / Jika ada dispensasi finance)</span>
          </label>
          <input
            type="file"
            accept="image/*,.pdf"
            data-testid="finance-proof-input"
            onChange={(e) => onFileUpload(e, (base64) => attachProof("finance", base64))}
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
  );
}
