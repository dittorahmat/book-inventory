import { useState } from "react";
import { CreditCard, Award, CheckCircle2 } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { FormFieldFeedback, FormSummaryAlert } from "../ui/FormFieldFeedback";
import { RegularPaymentForm } from "./RegularPaymentForm";
import {
  validatePhone,
  validateProofFile,
  validateRequiredSelect,
  validateRequiredText,
} from "../../lib/form-validation";
import type {
  BookPackageOption,
  FileUploadHandler,
} from "../../lib/portal-types";
import { PackageBreakdown } from "./PackageBreakdown";
import { WprQuestion } from "./WprQuestion";
import { validateAllocation } from "./order-draft";
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
    transferAmount,
    bookAllocationAmount,
    bankName,
    paymentProofBase64,
    parentPhoneManual,
    notes,
    homeAddress,
    hasTakenPackage,
  } = draft;
  const { edit, chooseOrderType, attachProof, setHasTakenPackage } = actions;
  const allocationCheck = validateAllocation({
    transferAmount,
    allocationAmount: bookAllocationAmount,
    bookTotal: pkg.price,
  });

  const [attempted, setAttempted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    const errors: Record<string, string | undefined> = {};

    if (orderType === "regular") {
      const proofCheck = validateProofFile(paymentProofBase64, "Bukti transfer pembayaran");
      if (!proofCheck.valid) errors.paymentProof = proofCheck.message;

      const bankCheck = validateRequiredSelect(bankName, "Bank Tujuan Transfer");
      if (!bankCheck.valid) errors.bankName = bankCheck.message;

      const phoneCheck = validatePhone(parentPhoneManual);
      if (!phoneCheck.valid) errors.parentPhoneManual = phoneCheck.message;

      if (!allocationCheck.ok) {
        errors.allocation = allocationCheck.message;
      }
    } else {
      const proofCheck = validateProofFile(scholarshipProofBase64, "Surat / Bukti Beasiswa");
      if (!proofCheck.valid) errors.scholarshipProof = proofCheck.message;
    }

    if (isSatuan) {
      const addressCheck = validateRequiredText(homeAddress, "Alamat Rumah Lengkap", 10);
      if (!addressCheck.valid) errors.homeAddress = addressCheck.message;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    onSubmit(e);
  };

  return (
    <form onSubmit={handleFormSubmit} noValidate className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E4E6EB] shadow-xs space-y-6">
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
          onClick={() => chooseOrderType("regular")}
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
          onClick={() => chooseOrderType("scholarship")}
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
              Foto Surat / Kartu Beasiswa <span className="text-rose-600">*Wajib</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                onFileUpload(e, (base64) => {
                  attachProof("scholarship", base64);
                  if (attempted) {
                    setFieldErrors((prev) => ({ ...prev, scholarshipProof: undefined }));
                  }
                });
              }}
              className="w-full text-xs text-[#65676B] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
            />
            <FormFieldFeedback error={attempted ? fieldErrors.scholarshipProof : undefined} />
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
        <RegularPaymentForm
          draft={draft}
          actions={actions}
          pkgPrice={pkg.price}
          allocationCheck={allocationCheck}
          attempted={attempted}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          onFileUpload={onFileUpload}
        />
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
            onChange={(e) => edit({ homeAddress: e.target.value })}
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
          onChange={(e) => edit({ notes: e.target.value })}
          placeholder="Catatan untuk bagian administrasi buku sekolah..."
          className="w-full px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
        />
      </div>

      <FormSummaryAlert errors={attempted ? fieldErrors : {}} />

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
