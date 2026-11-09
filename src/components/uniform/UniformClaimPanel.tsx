import { formatRupiah } from "../../lib/transfer-pricing";
import { UNIFORM_LABEL_CLS } from "./uniform-styles";
import type { UniformClaimRow } from "./uniform-admin-api";

interface UniformClaimPanelProps {
  claims: UniformClaimRow[];
  claimPeriod: string;
  onClaimPeriodChange: (val: string) => void;
  onClaim: () => Promise<void>;
  onLock: (id: string) => Promise<void>;
  logistics: boolean;
}

export function UniformClaimPanel({
  claims,
  claimPeriod,
  onClaimPeriodChange,
  onClaim,
  onLock,
  logistics,
}: UniformClaimPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 sm:p-5 space-y-4 shadow-xs">
      <div>
        <h3 className="text-base font-bold text-[#050505]">Klaim Tagihan ke Cabang</h3>
        <p className="text-xs text-[#65676B] mt-0.5">
          Snapshot tagihan per periode &amp; sekolah. Setelah dikunci, tukar/refund susulan tidak mengubah angka klaim
          ini secara retroaktif.
        </p>
      </div>

      {logistics && (
        <div className="flex flex-wrap items-end gap-3 p-3 bg-[#F8F9FA] rounded-xl border border-[#E4E6EB]">
          <div>
            <label className={UNIFORM_LABEL_CLS}>Pilih Periode Bulan</label>
            <input
              type="month"
              value={claimPeriod}
              onChange={(e) => onClaimPeriodChange(e.target.value)}
              className="rounded-xl border border-[#CED0D4] px-3 py-1.5 text-xs bg-white"
            />
          </div>
          <button
            type="button"
            onClick={onClaim}
            className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98] transition-colors"
          >
            + Terbitkan Klaim Cabang
          </button>
        </div>
      )}

      <div className="divide-y divide-[#E4E6EB] rounded-xl border border-[#E4E6EB] overflow-hidden">
        {claims.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-[#65676B]">Belum ada data klaim tagihan cabang terdaftar.</div>
        ) : (
          claims.map((c) => (
            <div
              key={c.id}
              className="px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F0F2F5]/40 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-sm text-[#050505]">{c.claimNumber}</span>
                  <span className="text-xs font-semibold text-[#65676B]">&bull; Periode: {c.period}</span>
                  {c.status === "locked" ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Terkunci
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Draft
                    </span>
                  )}
                </div>
                <div className="text-[#65676B] flex items-center gap-2 flex-wrap">
                  <span>
                    Total Qty: <strong>{c.totalQty} unit</strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    Tagihan: <strong className="text-[#1877F2]">{formatRupiah(c.totalAmount)}</strong>
                  </span>
                  <span className="text-[11px] text-[#65676B]">
                    (Barang: {formatRupiah(c.goodsAmount)} + Ongkir: {formatRupiah(c.shippingAmount)})
                  </span>
                </div>
                {(c.driftAmount ?? 0) !== 0 && (
                  <div className="pt-1">
                    <span
                      role="alert"
                      className="text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full inline-block"
                    >
                      Tagihan berubah setelah klaim dikunci: {formatRupiah(c.driftAmount ?? 0)}
                    </span>
                  </div>
                )}
              </div>

              {logistics && c.status === "draft" && (
                <button
                  type="button"
                  onClick={() => onLock(c.id)}
                  className="shrink-0 px-3.5 py-1.5 bg-[#F0F2F5] hover:bg-[#E4E6EB] text-[#050505] border border-[#CED0D4] rounded-lg text-xs font-semibold active:scale-[0.98] transition-all"
                >
                  Kunci Klaim
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
