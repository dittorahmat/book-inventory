import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Shirt } from "lucide-react";
import { useUniformOrder } from "../components/uniform/useUniformOrder";
import { UniformSearchStep } from "../components/uniform/UniformSearchStep";
import { UniformItemStep } from "../components/uniform/UniformItemStep";
import { FormFieldFeedback, FormSummaryAlert } from "../components/ui/FormFieldFeedback";
import { formatRupiah } from "../lib/transfer-pricing";
import { validateHomeAddress } from "../lib/home-address";
import { PendingOrderConfirmModal } from "../components/portal/PendingOrderConfirmModal";

export function PublicUniformOrderView() {
  const order = useUniformOrder();
  const [addressAttempted, setAddressAttempted] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const postalCodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    order.loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E7F3FF] text-[#1877F2] text-xs font-semibold mb-3">
          <Shirt className="w-4 h-4" />
          <span>Formulir Pesan Seragam</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#050505]">
          Pemesanan Seragam Sekolah
        </h1>
        <p className="text-xs text-[#65676B] mt-1 max-w-md mx-auto">
          Kain harian (laki-laki/perempuan) dan olahraga (S–10L per jenjang). Dikirim ke alamat rumah.
        </p>
        <div className="flex items-center justify-center gap-2 mt-5">
          {["Identitas", "Pilih Seragam", "Alamat", "Selesai"].map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3 | 4;
            return (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <div className="w-4 h-px bg-[#CED0D4]" />}
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${order.step === n ? "bg-[#1877F2] text-white" : "bg-[#E4E6EB] text-[#65676B]"}`}>
                  <span>{n}</span> {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {order.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Perhatian</div>
            <div>{order.error}</div>
          </div>
        </div>
      )}

      {order.step === 1 && (
        <>
          <UniformSearchStep
            order={{
              schools: order.schools,
              schoolId: order.schoolId,
              setSchoolId: order.setSchoolId,
              query: order.query,
              setQuery: order.setQuery,
              searching: order.searching,
              searched: order.searched,
              results: order.results,
              handleSearch: order.handleSearch,
              selectStudent: order.selectStudent,
              loading: order.loadingCatalog,
            }}
          />
          {order.pendingUniformOrder && (
            <PendingOrderConfirmModal
              order={order.pendingUniformOrder}
              kind="seragam"
              onReplace={order.confirmReplaceOrder}
              onKeepAndAdd={order.confirmKeepAndAddOrder}
              onCancel={order.cancelPendingModal}
            />
          )}
        </>
      )}

      {order.step === 2 && order.student && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E4E6EB] px-4 py-3 text-xs">
            <span className="font-bold">{order.student.name}</span>
            <span className="text-[#65676B]"> · Kelas {order.student.gradeLevel} · {order.student.schoolName}</span>
          </div>
          {order.loadingCatalog ? (
            <div className="bg-white rounded-2xl border border-[#E4E6EB] p-6 text-center text-xs text-[#65676B]">
              Memuat katalog seragam…
            </div>
          ) : (
            <UniformItemStep order={order} />
          )}
        </div>
      )}

      {order.step === 3 && order.student && (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] p-6 sm:p-7 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Jalur pembelian</label>
            <div className="grid grid-cols-2 gap-2">
              {(["regular", "scholarship"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => order.setOrderType(t)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all active:scale-[0.98] ${
                    order.orderType === t ? "border-[#1877F2] bg-[#E7F3FF]/40" : "border-[#E4E6EB] bg-white hover:border-[#CED0D4]"
                  }`}
                >
                  {t === "regular" ? "Reguler" : "Beasiswa / Free"}
                </button>
              ))}
            </div>
          </div>
          {order.orderType === "scholarship" && (
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Surat tanda beasiswa (wajib)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onloadend = () => order.setScholarshipProof(reader.result as string);
                  reader.readAsDataURL(file);
                }}
                className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white"
              />
            </div>
          )}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#050505] uppercase tracking-wider">Informasi Penerima & Alamat Kirim</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Nama Penerima (Wajib)</label>
                <input
                  type="text"
                  value={order.recipientName}
                  onChange={(e) => order.setRecipientName(e.target.value)}
                  placeholder="Nama lengkap penerima paket"
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${
                    addressAttempted && !order.recipientName.trim() ? "border-rose-500 bg-rose-50/20" : "border-[#CED0D4]"
                  }`}
                />
                <FormFieldFeedback
                  error={addressAttempted && !order.recipientName.trim() ? "Nama penerima wajib diisi." : undefined}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">No. HP / WhatsApp (Wajib)</label>
                <input
                  type="text"
                  value={order.recipientPhone}
                  onChange={(e) => order.setRecipientPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${
                    addressAttempted && !order.recipientPhone.trim() ? "border-rose-500 bg-rose-50/20" : "border-[#CED0D4]"
                  }`}
                />
                <FormFieldFeedback
                  error={addressAttempted && !order.recipientPhone.trim() ? "Nomor telepon/WA penerima wajib diisi." : undefined}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#050505] mb-1">Nama Jalan / Komplek (Wajib)</label>
                <input
                  ref={addressInputRef}
                  type="text"
                  value={order.street}
                  onChange={(e) => order.setStreet(e.target.value)}
                  placeholder="Contoh: Jl. Melati Indah Blok C"
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${
                    addressAttempted && !order.street.trim() ? "border-rose-500 bg-rose-50/20" : "border-[#CED0D4]"
                  }`}
                />
                <FormFieldFeedback
                  error={addressAttempted && !order.street.trim() ? "Nama jalan wajib diisi." : undefined}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">No. Rumah (Wajib)</label>
                <input
                  type="text"
                  value={order.houseNumber}
                  onChange={(e) => order.setHouseNumber(e.target.value)}
                  placeholder="No. 12"
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${
                    addressAttempted && !order.houseNumber.trim() ? "border-rose-500 bg-rose-50/20" : "border-[#CED0D4]"
                  }`}
                />
                <FormFieldFeedback
                  error={addressAttempted && !order.houseNumber.trim() ? "Nomor rumah wajib diisi." : undefined}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">RT (Wajib)</label>
                <input
                  type="text"
                  value={order.rt}
                  onChange={(e) => order.setRt(e.target.value)}
                  placeholder="01"
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${
                    addressAttempted && !order.rt.trim() ? "border-rose-500 bg-rose-50/20" : "border-[#CED0D4]"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">RW (Wajib)</label>
                <input
                  type="text"
                  value={order.rw}
                  onChange={(e) => order.setRw(e.target.value)}
                  placeholder="02"
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${
                    addressAttempted && !order.rw.trim() ? "border-rose-500 bg-rose-50/20" : "border-[#CED0D4]"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Kelurahan (Wajib)</label>
                <input
                  type="text"
                  value={order.kelurahan}
                  onChange={(e) => order.setKelurahan(e.target.value)}
                  placeholder="Kelurahan"
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${
                    addressAttempted && !order.kelurahan.trim() ? "border-rose-500 bg-rose-50/20" : "border-[#CED0D4]"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Kecamatan (Wajib)</label>
                <input
                  type="text"
                  value={order.kecamatan}
                  onChange={(e) => order.setKecamatan(e.target.value)}
                  placeholder="Kecamatan"
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${
                    addressAttempted && !order.kecamatan.trim() ? "border-rose-500 bg-rose-50/20" : "border-[#CED0D4]"
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Kota / Kabupaten (Wajib)</label>
                <input
                  type="text"
                  value={order.city}
                  onChange={(e) => order.setCity(e.target.value)}
                  placeholder="Kota / Kabupaten"
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${
                    addressAttempted && !order.city.trim() ? "border-rose-500 bg-rose-50/20" : "border-[#CED0D4]"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#050505] mb-1">Kode Pos (Opsional / 5 digit)</label>
                <input
                  ref={postalCodeInputRef}
                  type="text"
                  maxLength={5}
                  value={order.postalCode}
                  onChange={(e) => order.setPostalCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Contoh: 15310"
                  className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Catatan (opsional)</label>
            <input
              value={order.notes}
              onChange={(e) => order.setNotes(e.target.value)}
              placeholder="Patokan rumah, nomor WA aktif, dsb."
              className="w-full rounded-xl border border-[#CED0D4] px-3 py-2.5 text-sm"
            />
          </div>
          <div className="rounded-xl bg-[#F0F2F5] px-4 py-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-[#65676B]">Murid</span><span className="font-semibold">{order.student.name}</span></div>
            <div className="flex justify-between"><span className="text-[#65676B]">Item</span><span className="font-semibold">{order.itemCount} item</span></div>
            <div className="flex justify-between"><span className="text-[#65676B]">Total bayar</span><span className="font-bold">{order.orderType === "scholarship" ? "Rp 0 (Beasiswa)" : formatRupiah(order.total)}</span></div>
            <p className="text-[#65676B]">Seragam diasumsikan lunas — gudang menagih ke sekolah cabang.</p>
          </div>
          {addressAttempted && (!order.canSubmit || !order.isPostalCodeValid) && (
            <FormSummaryAlert
              title="Data Pengiriman Belum Lengkap"
              errors={{
                address: !order.address.trim()
                  ? "Alamat rumah pengiriman belum diisi."
                  : !validateHomeAddress(`${order.address.trim()}, RT 01 RW 01 15310`).ok
                  ? "Alamat rumah wajib diisi lengkap (min. 20 karakter)."
                  : !/(^|\W)rt\.?\s*\d/i.test(order.address) || !/(^|\W)rw\.?\s*\d/i.test(order.address)
                  ? "Alamat wajib memuat nomor RT dan RW."
                  : undefined,
                postalCode: !order.postalCode.trim()
                  ? "Kode pos pengiriman belum diisi."
                  : !order.isPostalCodeValid
                  ? "Kode pos harus berupa 5 digit angka."
                  : undefined,
                scholarship:
                  order.orderType === "scholarship" && !order.scholarshipProof
                    ? "Surat tanda beasiswa wajib diunggah untuk jalur beasiswa."
                    : undefined,
              }}
            />
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => order.setStep(2)}
              className="px-5 py-2.5 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
            >
              Kembali
            </button>
            <button
              type="button"
              disabled={order.submitting}
              onClick={() => {
                setAddressAttempted(true);
                if (order.canSubmit) {
                  order.handleSubmit();
                } else {
                  if (!order.address.trim() || !validateHomeAddress(`${order.address.trim()}, RT 01 RW 01 15310`).ok) {
                    addressInputRef.current?.focus();
                  } else if (!order.isPostalCodeValid) {
                    postalCodeInputRef.current?.focus();
                  }
                }
              }}
              className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98]"
            >
              {order.submitting ? "Memproses…" : "Buat Pesanan"}
            </button>
          </div>
        </div>
      )}

      {order.step === 4 && order.success && (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] p-6 sm:p-7 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#E7F3FF] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-[#1877F2]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold">Pesanan Diterima</h2>
            <p className="text-xs text-[#65676B] mt-1">
              Nomor <span className="font-bold text-[#050505]">{order.success.orderNumber}</span> · Total {formatRupiah(order.success.total)}.
              Seragam dikirim ke alamat rumah — status <span className="font-semibold">belum dikirim</span> hingga gudang memprosesnya.
            </p>
          </div>
          <button
            type="button"
            onClick={order.backToSearch}
            className="px-5 py-2.5 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
          >
            Pesan Lagi
          </button>
        </div>
      )}
    </div>
  );
}
