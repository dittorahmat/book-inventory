import { useEffect, useState } from "react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { formatRupiah } from "../../lib/transfer-pricing";
import {
  fetchUniformOrders, fetchUniformOrderDetail,
  fetchUniformVariants, fetchUniformPackages,
  fetchUniformExchanges, requestUniformExchange, resolveUniformExchange,
  fetchUniformRefunds, requestUniformRefund, resolveUniformRefund,
  approveUniformWithdrawal, checkSportsExchangeStock,
  type UniformOrderRow, type UniformOrderDetail, type UniformExchangeRow, type UniformRefundRow,
} from "./uniform-admin-api";

interface Props {
  schools: Array<{ id: string; name: string }>;
  lockedSchoolId?: string | null;
  logistics: boolean;
}

const inputCls = "w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white";
const labelCls = "block text-xs font-semibold text-[#050505] mb-1";

export function UniformReturnsSection({ schools, lockedSchoolId, logistics }: Props) {
  const [schoolId, setSchoolId] = useState(lockedSchoolId ?? "");
  const [keyword, setKeyword] = useState("");
  const [found, setFound] = useState<UniformOrderRow[]>([]);
  const [detail, setDetail] = useState<UniformOrderDetail | null>(null);
  const [variantNames, setVariantNames] = useState<Record<string, string>>({});
  const [olahraga, setOlahraga] = useState<Array<{ id: string; name: string; sizes: string[] }>>([]);
  const [packageNames, setPackageNames] = useState<Record<string, string>>({});
  const [exchanges, setExchanges] = useState<UniformExchangeRow[]>([]);
  const [refunds, setRefunds] = useState<UniformRefundRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [exItem, setExItem] = useState("");
  const [exNewVariant, setExNewVariant] = useState("");
  const [exNewSize, setExNewSize] = useState("");
  const [exReason, setExReason] = useState("");
  const [rfAmount, setRfAmount] = useState("");
  const [rfReason, setRfReason] = useState("");

  useEffect(() => {
    Promise.all([fetchUniformVariants(), fetchUniformPackages()])
      .then(([v, p]) => {
        setVariantNames(Object.fromEntries(v.map((x) => [x.variant.id, x.variant.name])));
        setOlahraga(v.filter((x) => x.variant.kind === "olahraga").map((x) => ({ id: x.variant.id, name: x.variant.name, sizes: x.sizes })));
        setPackageNames(Object.fromEntries(p.map((x) => [x.package.id, x.package.name])));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat katalog."));
  }, []);

  const reloadQueues = async (sid: string) => {
    const [ex, rf] = await Promise.all([
      fetchUniformExchanges({ schoolId: sid || undefined }),
      fetchUniformRefunds({ schoolId: sid || undefined }),
    ]);
    setExchanges(ex);
    setRefunds(rf);
  };

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(okMsg);
      if (detail) setDetail(await fetchUniformOrderDetail(detail.order.id));
      await reloadQueues(schoolId).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operasi gagal.");
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    setBusy(true);
    setError(null);
    try {
      setFound(await fetchUniformOrders({ schoolId: schoolId || undefined, search: keyword.trim() || undefined }));
      setDetail(null);
      await reloadQueues(schoolId).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencari order.");
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      setDetail(await fetchUniformOrderDetail(id));
      setExItem("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail order.");
    } finally {
      setBusy(false);
    }
  };

  const itemLabel = (i: UniformOrderDetail["items"][number]) =>
    i.variantId ? `${variantNames[i.variantId] ?? i.variantId} · ${i.size} ×${i.quantity}` : `${packageNames[i.packageId ?? ""] ?? i.packageId} ×${i.quantity}`;

  const selectedItem = detail?.items.find((i) => i.id === exItem) ?? null;

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">{notice}</div>}

      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 grid gap-3 sm:grid-cols-3">
        <div>
          <SearchableSingleSelect
            label="Sekolah"
            options={schools.map((s) => ({ value: s.id, label: s.name }))}
            value={schoolId}
            onChange={setSchoolId}
            placeholder="Semua sekolah"
            disabled={!!lockedSchoolId}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Nomor order / nama / NIS</label>
          <div className="flex gap-2">
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} className={inputCls} placeholder="Perlu filter sekolah bila mencari" />
            <button type="button" onClick={search} disabled={busy} className="px-4 py-2 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]">Cari</button>
          </div>
        </div>
      </div>

      {found.length > 0 && !detail && (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] divide-y divide-[#E4E6EB]">
          {found.map((r) => (
            <button key={r.id} type="button" onClick={() => openDetail(r.id)} className="w-full text-left px-4 py-3 hover:bg-[#F0F2F5] active:scale-[0.99]">
              <div className="text-sm font-semibold">{r.orderNumber} <span className="font-normal text-[#65676B]">· {r.studentName}</span></div>
              <div className="text-xs text-[#65676B]">{r.shipmentStatus === "sudah_dikirim" ? "Terkirim" : "Belum terkirim"} · {formatRupiah(r.totalAmount)}</div>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold">{detail.order.orderNumber}</div>
              <div className="text-xs text-[#65676B]">{detail.order.studentName} · {detail.order.schoolName} · {formatRupiah(detail.order.totalAmount)}</div>
            </div>
            <button type="button" onClick={() => setDetail(null)} className="px-3 py-1.5 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]">Tutup</button>
          </div>
          <div className="text-xs text-[#65676B]">{detail.items.map(itemLabel).join(" · ")}</div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#E4E6EB] p-3 space-y-2">
              <h4 className="text-xs font-bold">Tukar ukuran (olahraga ≤14 hari)</h4>
              <div><SearchableSingleSelect
                label="Item lama"
                options={detail.items.filter((i) => i.variantId).map((i) => ({ value: i.id, label: itemLabel(i) }))}
                value={exItem}
                onChange={setExItem}
                placeholder="— Pilih item —"
              />
              </div>
              <div><SearchableSingleSelect
                label="Varian baru"
                options={olahraga.map((v) => ({ value: v.id, label: v.name }))}
                value={exNewVariant}
                onChange={(v) => { setExNewVariant(v); setExNewSize(""); }}
                placeholder="— Pilih varian —"
              />
              </div>
              <div><SearchableSingleSelect
                label="Size baru"
                options={(olahraga.find((v) => v.id === exNewVariant)?.sizes ?? []).map((s) => ({ value: s, label: s }))}
                value={exNewSize}
                onChange={setExNewSize}
                placeholder="— Pilih size —"
              />
              </div>
              <div><label className={labelCls}>Alasan</label><input value={exReason} onChange={(e) => setExReason(e.target.value)} className={inputCls} /></div>
              <button
                type="button" disabled={busy || !selectedItem?.variantId}
                onClick={() => run(() => requestUniformExchange({
                  orderId: detail.order.id, oldVariantId: selectedItem?.variantId, oldSize: selectedItem?.size,
                  newVariantId: exNewVariant, newSize: exNewSize, reason: exReason,
                }), "Pengajuan tukar tercatat.")}
                className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
              >
                Ajukan Tukar
              </button>
            </div>
            <div className="rounded-xl border border-[#E4E6EB] p-3 space-y-2">
              <h4 className="text-xs font-bold">Refund dana</h4>
              <div><label className={labelCls}>Nominal (maks {formatRupiah(detail.order.totalAmount)})</label>
                <input value={rfAmount} inputMode="numeric" onChange={(e) => setRfAmount(e.target.value)} className={inputCls} placeholder={String(detail.order.totalAmount)} />
              </div>
              <div><label className={labelCls}>Alasan</label><input value={rfReason} onChange={(e) => setRfReason(e.target.value)} className={inputCls} /></div>
              <button
                type="button" disabled={busy}
                onClick={() => run(() => requestUniformRefund({
                  orderId: detail.order.id,
                  amount: rfAmount.trim() ? Number(rfAmount) : undefined,
                  reason: rfReason,
                }), "Pengajuan refund tercatat.")}
                className="px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
              >
                Ajukan Refund
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-white rounded-2xl border border-[#E4E6EB] divide-y divide-[#E4E6EB]">
          <div className="px-4 py-3 text-xs font-bold">Antrian tukar ukuran</div>
          {exchanges.length === 0 && <div className="px-4 py-4 text-xs text-[#65676B]">Kosong. Cari order dahulu untuk memuat antrian sekolah.</div>}
          {exchanges.map((x) => (
            <div key={x.id} className="px-4 py-3 text-xs space-y-1">
              <div className="font-semibold">{variantNames[x.oldVariantId] ?? x.oldVariantId} {x.oldSize} → {variantNames[x.newVariantId] ?? x.newVariantId} {x.newSize}</div>
              <div className="text-[#65676B]">{x.reason} · {x.status}</div>
              {logistics && x.status === "requested" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        const chk = await checkSportsExchangeStock(x.id);
                        if (chk.available) {
                          const resi = window.prompt(`Stok ready (${chk.quantity} pcs). Masukkan No. Resi Kirim Pengganti:`);
                          if (!resi) return;
                          await run(() => resolveUniformExchange(x.id, "approve_ready", { replacementResi: resi.trim() }), "Tukar disetujui (Ready Stock) dengan resi pengiriman baru.");
                        } else {
                          const eta = window.prompt("Stok 0 (Backorder). Masukkan estimasi tanggal kirim (YYYY-MM-DD):", "2026-11-15");
                          if (!eta) return;
                          await run(() => resolveUniformExchange(x.id, "approve_backorder", { estimatedShipDate: eta.trim() }), "Tukar disetujui (Backorder) dengan estimasi tanggal kirim.");
                        }
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Gagal memeriksa stok.");
                      }
                    }}
                    className="px-3 py-1.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98]"
                  >
                    Verifikasi Fisik & Stok
                  </button>
                  <button type="button" disabled={busy} onClick={() => run(() => resolveUniformExchange(x.id, "reject"), "Tukar ditolak.")} className="px-3 py-1.5 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]">Tolak</button>
                </div>
              )}
              {logistics && x.status === "approved" && (
                <button type="button" disabled={busy} onClick={() => run(() => resolveUniformExchange(x.id, "complete"), "Tukar selesai, stok dipindah.")} className="px-3 py-1.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98]">Selesaikan</button>
              )}
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-[#E4E6EB] divide-y divide-[#E4E6EB]">
          <div className="px-4 py-3 text-xs font-bold">Antrian refund</div>
          {refunds.length === 0 && <div className="px-4 py-4 text-xs text-[#65676B]">Kosong. Cari order dahulu untuk memuat antrian sekolah.</div>}
          {refunds.map((r) => (
            <div key={r.id} className="px-4 py-3 text-xs space-y-1">
              <div className="font-semibold">{r.refundNumber} · {formatRupiah(r.amount)}</div>
              <div className="text-[#65676B]">{r.reason} · {r.status}</div>
              {logistics && r.status === "requested" && (
                <div className="flex flex-wrap gap-2">
                  {r.reason.includes("[PENGUNDURAN DIRI]") ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => approveUniformWithdrawal(r.id),
                          "Fisik seragam retur diterima & slip RET-U diterbitkan untuk Finance."
                        )
                      }
                      className="px-3 py-1.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98]"
                    >
                      Konfirmasi Terima Fisik & Terbitkan Slip
                    </button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => run(() => resolveUniformRefund(r.id, "approve"), "Refund disetujui.")} className="px-3 py-1.5 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]">Setujui</button>
                  )}
                  <button type="button" disabled={busy} onClick={() => run(() => resolveUniformRefund(r.id, "reject"), "Refund ditolak.")} className="px-3 py-1.5 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]">Tolak</button>
                </div>
              )}
              {logistics && r.status === "approved" && (
                <button type="button" disabled={busy} onClick={() => run(() => resolveUniformRefund(r.id, "refund"), "Refund selesai, stok dipulihkan.")} className="px-3 py-1.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98]">Refund</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
