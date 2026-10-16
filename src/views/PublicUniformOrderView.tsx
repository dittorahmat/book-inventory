import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Shirt } from "lucide-react";
import { useUniformOrder } from "../components/uniform/useUniformOrder";
import { UniformSearchStep } from "../components/uniform/UniformSearchStep";
import { UniformItemStep } from "../components/uniform/UniformItemStep";
import { formatRupiah } from "../lib/transfer-pricing";

export function PublicUniformOrderView() {
  const order = useUniformOrder();

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
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Alamat rumah pengiriman</label>
            <textarea
              value={order.address}
              onChange={(e) => order.setAddress(e.target.value)}
              rows={3}
              placeholder="Jalan, RT/RW, kelurahan, kecamatan, kota, kode pos (wajib RT, RW, kode pos)"
              className="w-full rounded-xl border border-[#CED0D4] px-3 py-2.5 text-sm"
            />
            <p className="text-[11px] text-[#65676B] mt-1">Wajib memuat RT, RW, dan kode pos. Satu order dikirim ke satu alamat.</p>
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
              disabled={!order.canSubmit || order.submitting}
              onClick={order.handleSubmit}
              className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-40 hover:bg-[#1664D9] active:scale-[0.98]"
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
