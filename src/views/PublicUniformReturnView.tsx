import { useEffect } from "react";
import { AlertCircle, CheckCircle2, ArrowLeftRight } from "lucide-react";
import { useUniformReturn } from "../components/uniform/useUniformReturn";
import { UniformSearchStep } from "../components/uniform/UniformSearchStep";
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
                <label className={labelCls}>Pilih order</label>
                <select value={ret.selectedOrderId} onChange={(e) => ret.setSelectedOrderId(e.target.value)} className={inputCls}>
                  {ret.orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} · {formatRupiah(o.totalAmount)} · {o.shipmentStatus === "sudah_dikirim" ? "terkirim" : "belum kirim"}
                    </option>
                  ))}
                </select>
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
              {ret.mode === "exchange" ? (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Item yang ditukar</label>
                    <select value={ret.exItemId} onChange={(e) => ret.setExItemId(e.target.value)} className={inputCls}>
                      <option value="">— Pilih item —</option>
                      {ret.selectedItems.filter((i) => i.variantId).map((i) => (
                        <option key={i.id} value={i.id}>{ret.itemLabel(i)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Varian baru</label>
                      <select value={ret.exNewVariant} onChange={(e) => { ret.setExNewVariant(e.target.value); ret.setExNewSize(""); }} className={inputCls}>
                        <option value="">— Pilih varian —</option>
                        {ret.olahraga.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Size baru</label>
                      <select value={ret.exNewSize} onChange={(e) => ret.setExNewSize(e.target.value)} className={inputCls}>
                        <option value="">— Pilih size —</option>
                        {(ret.olahraga.find((v) => v.id === ret.exNewVariant)?.sizes ?? []).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
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
