import { formatRupiah } from "../../lib/transfer-pricing";
import {
  checkSportsExchangeStock,
  resolveUniformExchange,
  resolveUniformRefund,
  approveUniformWithdrawal,
  type UniformExchangeRow,
  type UniformRefundRow,
} from "./uniform-admin-api";

interface UniformReturnQueuesProps {
  activeTab: "exchanges" | "refunds";
  exchanges: UniformExchangeRow[];
  refunds: UniformRefundRow[];
  variantNames: Record<string, string>;
  logistics: boolean;
  busy: boolean;
  searchQuery: string;
  setError: (err: string | null) => void;
  run: (fn: () => Promise<unknown>, okMsg: string) => Promise<void>;
}

export function UniformReturnQueues({
  activeTab,
  exchanges,
  refunds,
  variantNames,
  logistics,
  busy,
  searchQuery,
  setError,
  run,
}: UniformReturnQueuesProps) {
  const filteredExchanges = exchanges.filter((x) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const oldName = variantNames[x.oldVariantId] ?? x.oldVariantId;
    const newName = variantNames[x.newVariantId] ?? x.newVariantId;
    return (
      oldName.toLowerCase().includes(q) ||
      newName.toLowerCase().includes(q) ||
      x.reason.toLowerCase().includes(q) ||
      x.status.toLowerCase().includes(q)
    );
  });

  const filteredRefunds = refunds.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.refundNumber.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  });

  if (activeTab === "exchanges") {
    return (
      <div className="divide-y divide-[#E4E6EB]">
        {filteredExchanges.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[#65676B]">
            {exchanges.length === 0
              ? "Antrean tukar ukuran kosong. Silakan cari pesanan di atas untuk memuat antrean cabang."
              : "Tidak ada antrean tukar yang cocok dengan kata kunci pencarian."}
          </div>
        ) : (
          filteredExchanges.map((x) => (
            <div key={x.id} className="p-4 text-xs space-y-2 hover:bg-[#F0F2F5]/30 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-[#050505] text-sm">
                    {variantNames[x.oldVariantId] ?? x.oldVariantId} ({x.oldSize}) &rarr;{" "}
                    {variantNames[x.newVariantId] ?? x.newVariantId} ({x.newSize})
                  </div>
                  <div className="text-[#65676B] mt-0.5">
                    Alasan: {x.reason || "-"} &bull; Status:{" "}
                    <span className="font-semibold uppercase text-[#1877F2]">{x.status}</span>
                  </div>
                </div>

                {logistics && x.status === "requested" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        try {
                          const chk = await checkSportsExchangeStock(x.id);
                          if (chk.available) {
                            const resi = window.prompt(
                              `Stok ready (${chk.quantity} pcs). Masukkan No. Resi Kirim Pengganti:`
                            );
                            if (!resi) return;
                            await run(
                              () =>
                                resolveUniformExchange(x.id, "approve_ready", {
                                  replacementResi: resi.trim(),
                                }),
                              "Tukar disetujui (Ready Stock) dengan resi pengiriman baru."
                            );
                          } else {
                            const eta = window.prompt(
                              "Stok 0 (Backorder). Masukkan estimasi tanggal kirim (YYYY-MM-DD):",
                              "2026-11-15"
                            );
                            if (!eta) return;
                            await run(
                              () =>
                                resolveUniformExchange(x.id, "approve_backorder", {
                                  estimatedShipDate: eta.trim(),
                                }),
                              "Tukar disetujui (Backorder) dengan estimasi tanggal kirim."
                            );
                          }
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Gagal memeriksa stok.");
                        }
                      }}
                      className="px-3 py-1.5 bg-[#1877F2] text-white rounded-lg text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98] transition-all"
                    >
                      Verifikasi Fisik & Stok
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => resolveUniformExchange(x.id, "reject"), "Tukar ditolak.")}
                      className="px-3 py-1.5 bg-[#F0F2F5] rounded-lg text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
                    >
                      Tolak
                    </button>
                  </div>
                )}

                {logistics && x.status === "approved" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(() => resolveUniformExchange(x.id, "complete"), "Tukar selesai, stok dipindah.")
                    }
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 active:scale-[0.98]"
                  >
                    Selesaikan
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#E4E6EB]">
      {filteredRefunds.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-[#65676B]">
          {refunds.length === 0
            ? "Antrean refund dana kosong. Silakan cari pesanan di atas untuk memuat antrean cabang."
            : "Tidak ada antrean refund yang cocok dengan kata kunci pencarian."}
        </div>
      ) : (
        filteredRefunds.map((r) => (
          <div key={r.id} className="p-4 text-xs space-y-2 hover:bg-[#F0F2F5]/30 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-bold text-[#050505] text-sm">
                  {r.refundNumber} &bull; <strong className="text-rose-600">{formatRupiah(r.amount)}</strong>
                </div>
                <div className="text-[#65676B] mt-0.5">
                  Alasan: {r.reason || "-"} &bull; Status:{" "}
                  <span className="font-semibold uppercase text-rose-700">{r.status}</span>
                </div>
              </div>

              {logistics && r.status === "requested" && (
                <div className="flex items-center gap-2 shrink-0">
                  {r.kind === "withdrawal" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => approveUniformWithdrawal(r.id),
                          "Fisik seragam retur diterima & slip RET-U diterbitkan untuk Finance."
                        )
                      }
                      className="px-3 py-1.5 bg-[#1877F2] text-white rounded-lg text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98]"
                    >
                      Konfirmasi Terima Fisik & Terbitkan Slip
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => resolveUniformRefund(r.id, "approve"), "Refund disetujui.")}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 active:scale-[0.98]"
                    >
                      Setujui
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => resolveUniformRefund(r.id, "reject"), "Refund ditolak.")}
                    className="px-3 py-1.5 bg-[#F0F2F5] rounded-lg text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
                  >
                    Tolak
                  </button>
                </div>
              )}

              {logistics && r.status === "approved" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() => resolveUniformRefund(r.id, "refund"), "Refund selesai, stok dipulihkan.")
                  }
                  className="px-3 py-1.5 bg-[#1877F2] text-white rounded-lg text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98]"
                >
                  Refund Selesai
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
