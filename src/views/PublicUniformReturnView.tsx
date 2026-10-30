import { useEffect } from "react";
import { AlertCircle, CheckCircle2, ArrowLeftRight, ImagePlus } from "lucide-react";
import { SearchableSingleSelect } from "../components/ui/SearchableSingleSelect";
import { useUniformReturn } from "../components/uniform/useUniformReturn";
import { UniformSearchStep } from "../components/uniform/UniformSearchStep";
import { WarehouseReturnAddressCard } from "../components/portal/WarehouseReturnAddressCard";
import { formatRupiah } from "../lib/transfer-pricing";

const inputCls = "w-full rounded-xl border border-[#CED0D4] px-3 py-2.5 text-sm bg-white";
const labelCls = "block text-xs font-semibold text-[#050505] mb-1";

export function PublicUniformReturnView() {
  const ret = useUniformReturn();

  useEffect(() => {
    ret.loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E7F3FF] text-[#1877F2] text-xs font-semibold mb-3">
          <ArrowLeftRight className="w-4 h-4" />
          <span>Tukar Ukuran & Refund Seragam</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#050505]">Pengajuan Mandiri Ortu</h1>
        <p className="text-xs text-[#65676B] mt-1 max-w-md mx-auto">
          Tukar ukuran olahraga (belum dipakai, ≤14 hari) atau refund dana. Kain yang sudah dipotong tidak bisa tukar.
        </p>
      </div>

      {ret.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div><div className="font-bold">Perhatian</div><div>{ret.error}</div></div>
        </div>
      )}

      {ret.step === 1 && (
        <UniformSearchStep
          order={{
            schools: ret.schools,
            schoolId: ret.schoolId,
            setSchoolId: ret.setSchoolId,
            query: ret.query,
            setQuery: ret.setQuery,
            searching: ret.searching,
            searched: ret.searched,
            results: ret.results,
            handleSearch: ret.handleSearch,
            selectStudent: ret.selectStudent,
            loading: ret.loadingOrders,
          }}
        />
      )}

      {ret.step === 2 && ret.student && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E4E6EB] px-4 py-3 text-xs">
            <span className="font-bold">{ret.student.name}</span>
            <span className="text-[#65676B]"> · Kelas {ret.student.gradeLevel} · {ret.student.schoolName}</span>
          </div>
          {ret.orders.length === 0 && !ret.loadingOrders && (
            <div className="bg-white rounded-2xl border border-[#E4E6EB] p-6 text-center text-xs text-[#65676B]">
              Belum ada order seragam untuk murid ini.
            </div>
          )}
          {ret.orders.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 sm:p-5 space-y-4">
              <div>
                <SearchableSingleSelect
                  label="Pilih order"
                  options={ret.orders.map((o) => ({
                    value: o.id,
                    label: o.orderNumber,
                    hint: `${formatRupiah(o.totalAmount)} · ${o.shipmentStatus === "sudah_dikirim" ? "terkirim" : "belum kirim"}`,
                  }))}
                  value={ret.selectedOrderId}
                  onChange={ret.setSelectedOrderId}
                  placeholder="Pilih order..."
                />
              </div>
              {ret.selectedOrder && (
                <div className="text-xs text-[#65676B]">{ret.selectedItems.map(ret.itemLabel).join(" · ")}</div>
              )}
              <div className="inline-flex p-1 bg-[#E4E6EB]/70 rounded-2xl gap-1">
                {(["exchange", "refund"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => ret.setMode(m)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${ret.mode === m ? "bg-white text-[#1877F2] shadow-xs" : "text-[#65676B] hover:text-[#050505]"}`}
                  >
                    {m === "exchange" ? "Tukar Ukuran" : "Refund Dana"}
                  </button>
                ))}
              </div>
              {ret.mode === "refund" && (
                <div className="p-3 bg-[#F7F8FA] border border-[#E4E6EB] rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-[#050505] block">Siswa Mengundurkan Diri?</span>
                    <span className="text-[11px] text-[#65676B] block">Kembalikan fisik seragam via ekspedisi ke Gudang Pusat</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ret.isWithdrawal}
                      onChange={(e) => ret.setIsWithdrawal(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1877F2]"></div>
                  </label>
                </div>
              )}

              {ret.mode === "refund" && ret.isWithdrawal && (
                <div className="space-y-3">
                  <WarehouseReturnAddressCard />
                  <div>
                    <label className={labelCls}>
                      No. Resi Kurir Pengiriman Retur ke Gudang Pusat <span className="text-red-600">*</span>
                    </label>
                    <input
                      value={ret.courierResi}
                      onChange={(e) => ret.setCourierResi(e.target.value)}
                      placeholder="Contoh: JNE / J&T / SiCepat - JP12345678"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-[#050505] mb-1">Surat Pengunduran Diri Resmi</span>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="uniform-withdrawal-doc"
                        className="px-4 py-2 bg-white border border-[#CED0D4] hover:bg-[#F0F2F5] active:scale-[0.98] text-[#050505] text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ImagePlus className="w-4 h-4 text-[#1877F2]" />
                        <span>{ret.letterBase64 ? "Ganti Dokumen" : "Unggah Dokumen"}</span>
                      </label>
                      <input
                        id="uniform-withdrawal-doc"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label="Surat pengunduran diri siswa"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => ret.setLetterBase64(String(reader.result));
                          reader.readAsDataURL(file);
                        }}
                        className="sr-only"
                      />
                      {ret.letterBase64 && (
                        <img
                          src={ret.letterBase64}
                          alt="Pratinjau surat mundur"
                          className="h-14 w-14 object-cover rounded-xl border border-[#E4E6EB]"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {ret.mode === "exchange" ? (
                <div className="space-y-3">
                  <WarehouseReturnAddressCard />
                  <div>
                    <label className={labelCls}>
                      No. Resi Kurir Pengiriman Seragam ke Gudang Pusat <span className="text-red-600">*</span>
                    </label>
                    <input
                      value={ret.exCourierResi}
                      onChange={(e) => ret.setExCourierResi(e.target.value)}
                      placeholder="Contoh: JNE / J&T / SiCepat - JP98765432"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <SearchableSingleSelect
                      label="Item yang ditukar"
                      options={ret.selectedItems.filter((i) => i.variantId).map((i) => ({ value: i.id, label: ret.itemLabel(i) }))}
                      value={ret.exItemId}
                      onChange={ret.setExItemId}
                      placeholder="— Pilih item —"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <SearchableSingleSelect
                        label="Varian baru"
                        options={ret.olahraga.map((v) => ({ value: v.id, label: v.name }))}
                        value={ret.exNewVariant}
                        onChange={(v) => { ret.setExNewVariant(v); ret.setExNewSize(""); }}
                        placeholder="— Pilih varian —"
                      />
                    </div>
                    <div>
                      <SearchableSingleSelect
                        label="Size baru"
                        options={(ret.olahraga.find((v) => v.id === ret.exNewVariant)?.sizes ?? []).map((s) => ({ value: s, label: s }))}
                        value={ret.exNewSize}
                        onChange={ret.setExNewSize}
                        placeholder="— Pilih size —"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Nominal (maks {formatRupiah(ret.selectedOrder?.totalAmount ?? 0)}, kosongkan = penuh)</label>
                  <input value={ret.amount} inputMode="numeric" onChange={(e) => ret.setAmount(e.target.value)} className={inputCls} />
                </div>
              )}
              <div>
                <label className={labelCls}>Alasan</label>
                <input value={ret.reason} onChange={(e) => ret.setReason(e.target.value)} placeholder="Contoh: kekecilan / jahitan lepas" className={inputCls} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button" onClick={ret.backToSearch}
                  className="px-5 py-2.5 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  disabled={!(ret.mode === "exchange" ? ret.canSubmitExchange : ret.canSubmitRefund) || ret.submitting}
                  onClick={ret.handleSubmit}
                  className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-40 hover:bg-[#1664D9] active:scale-[0.98]"
                >
                  {ret.submitting ? "Mengirim…" : "Kirim Pengajuan"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {ret.step === 3 && ret.success && (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] p-6 sm:p-7 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#E7F3FF] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-[#1877F2]" />
          </div>
          <p className="text-xs text-[#65676B] max-w-sm mx-auto">{ret.success}</p>
          <button
            type="button" onClick={ret.backToSearch}
            className="px-5 py-2.5 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
          >
            Kembali
          </button>
        </div>
      )}
    </div>
  );
}
