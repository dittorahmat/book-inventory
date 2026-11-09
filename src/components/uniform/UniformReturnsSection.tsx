import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { formatRupiah } from "../../lib/transfer-pricing";
import {
  fetchUniformOrders, fetchUniformOrderDetail,
  fetchUniformVariants, fetchUniformPackages,
  fetchUniformExchanges, requestUniformExchange,
  fetchUniformRefunds, requestUniformRefund,
  type UniformOrderRow, type UniformOrderDetail, type UniformExchangeRow, type UniformRefundRow,
} from "./uniform-admin-api";
import { UniformReturnDetailPanel } from "./UniformReturnDetailPanel";
import { UniformReturnQueues } from "./UniformReturnQueues";

interface Props {
  schools: Array<{ id: string; name: string }>;
  lockedSchoolId?: string | null;
  logistics: boolean;
}

import { UNIFORM_LABEL_CLS } from "./uniform-styles";

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

  // Active queue tab & search
  const [activeQueueTab, setActiveQueueTab] = useState<"exchanges" | "refunds">("exchanges");
  const [queueSearch, setQueueSearch] = useState("");

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
      try {
        await reloadQueues(schoolId);
      } catch (queueErr) {
        setError(queueErr instanceof Error ? queueErr.message : "Gagal memuat antrean retur.");
      }
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
      try {
        await reloadQueues(schoolId);
      } catch (queueErr) {
        setError(queueErr instanceof Error ? queueErr.message : "Gagal memuat antrean retur.");
      }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail order.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">{notice}</div>}

      {/* Header & Order Lookup Panel */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 sm:p-5 space-y-4 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-[#050505]">Tukar Ukuran & Retur Seragam</h2>
          <p className="text-xs text-[#65676B] mt-0.5">
            Cari pesanan siswa untuk mengajukan tukar ukuran seragam olahraga atau proses refund dana.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-[#F0F2F5]">
          <div>
            <SearchableSingleSelect
              label="Sekolah / Cabang"
              options={schools.map((s) => ({ value: s.id, label: s.name }))}
              value={schoolId}
              onChange={setSchoolId}
              placeholder="Pilih sekolah / cabang..."
              disabled={!!lockedSchoolId}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={UNIFORM_LABEL_CLS}>Cari Nomor Order / Nama Siswa / NIS</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#65676B]" />
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  className="pl-9 pr-3 py-2 text-xs border border-[#CED0D4] rounded-xl bg-white w-full focus:outline-none focus:border-[#1877F2]"
                  placeholder="Masukkan nomor order / nama siswa..."
                />
              </div>
              <button
                type="button"
                onClick={search}
                disabled={busy}
                className="px-5 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold hover:bg-[#1664D9] active:scale-[0.98] transition-colors shrink-0"
              >
                Cari Order
              </button>
            </div>
          </div>
        </div>

        {/* List Hasil Pencarian Order */}
        {found.length > 0 && !detail && (
          <div className="rounded-xl border border-[#E4E6EB] divide-y divide-[#E4E6EB] overflow-hidden mt-3 bg-[#F8F9FA]">
            <div className="px-4 py-2 text-[11px] font-bold text-[#65676B] bg-[#F0F2F5]">
              Hasil Pencarian ({found.length} pesanan ditemukan):
            </div>
            {found.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => openDetail(r.id)}
                className="w-full text-left px-4 py-3 hover:bg-white active:scale-[0.99] transition-colors flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-bold text-[#050505]">
                    {r.orderNumber} <span className="font-semibold text-[#65676B]">· {r.studentName} ({r.nis})</span>
                  </div>
                  <div className="text-xs text-[#65676B] mt-0.5">
                    {r.schoolName} &bull; Total: <strong className="text-[#1877F2]">{formatRupiah(r.totalAmount)}</strong>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  r.shipmentStatus === "sudah_dikirim" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {r.shipmentStatus === "sudah_dikirim" ? "Sudah Terkirim" : "Belum Terkirim"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Order & Formulir Aksi Tukar/Refund */}
      {detail && (
        <UniformReturnDetailPanel
          detail={detail}
          variantNames={variantNames}
          packageNames={packageNames}
          olahraga={olahraga}
          busy={busy}
          onClose={() => setDetail(null)}
          onRequestExchange={async (params) => {
            await run(
              () =>
                requestUniformExchange({
                  orderId: detail.order.id,
                  oldVariantId: params.oldVariantId,
                  oldSize: params.oldSize,
                  newVariantId: params.newVariantId,
                  newSize: params.newSize,
                  reason: params.reason,
                }),
              "Pengajuan tukar ukuran berhasil dicatat."
            );
          }}
          onRequestRefund={async (params) => {
            await run(
              () =>
                requestUniformRefund({
                  orderId: detail.order.id,
                  amount: params.amount,
                  reason: params.reason,
                }),
              "Pengajuan refund berhasil dicatat."
            );
          }}
        />
      )}

      {/* Antrean Operasional: Tab Tukar Ukuran vs. Refund Dana */}
      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden space-y-0">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E6EB]">
          <div>
            <h3 className="text-base font-bold text-[#050505]">Antrean Tindak Lanjut Petugas</h3>
            <p className="text-xs text-[#65676B] mt-0.5">Kelola verifikasi stok tukar dan persetujuan pengembalian dana.</p>
          </div>

          <div className="flex items-center gap-1 bg-[#F0F2F5] p-1 rounded-xl border border-[#E4E6EB]">
            <button
              type="button"
              onClick={() => setActiveQueueTab("exchanges")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeQueueTab === "exchanges"
                  ? "bg-white text-[#1877F2] shadow-2xs"
                  : "text-[#65676B] hover:text-[#050505]"
              }`}
            >
              Tukar Ukuran ({exchanges.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveQueueTab("refunds")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeQueueTab === "refunds"
                  ? "bg-white text-rose-600 shadow-2xs"
                  : "text-[#65676B] hover:text-[#050505]"
              }`}
            >
              Refund Dana ({refunds.length})
            </button>
          </div>
        </div>

        {/* Search Toolbar for Queues */}
        <div className="p-3 bg-[#F8F9FA] border-b border-[#E4E6EB]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#65676B]" />
            <input
              type="text"
              placeholder={`Cari dalam antrean ${activeQueueTab === "exchanges" ? "tukar ukuran" : "refund"}...`}
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-[#CED0D4] rounded-xl bg-white w-full focus:outline-none focus:border-[#1877F2]"
            />
          </div>
        </div>

        {/* Antrean Items Component */}
        <UniformReturnQueues
          activeTab={activeQueueTab}
          exchanges={exchanges}
          refunds={refunds}
          variantNames={variantNames}
          logistics={logistics}
          busy={busy}
          searchQuery={queueSearch}
          setError={setError}
          run={run}
        />
      </div>
    </div>
  );
}
