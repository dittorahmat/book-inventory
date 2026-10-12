import { useCallback, useEffect, useState } from "react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { fetchUniformOrders, markUniformShipped, type UniformOrderRow } from "./uniform-admin-api";

interface Props {
  schools: Array<{ id: string; name: string }>;
  lockedSchoolId?: string | null;
}

export function UniformShipmentSection({ schools, lockedSchoolId }: Props) {
  const [schoolId, setSchoolId] = useState(lockedSchoolId ?? "");
  const [status, setStatus] = useState("belum_dikirim");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<UniformOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchUniformOrders({ schoolId: schoolId || undefined, shipmentStatus: status || undefined, search: search.trim() || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat order seragam.");
    } finally {
      setLoading(false);
    }
  }, [schoolId, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleShip = async (id: string) => {
    setShippingId(id);
    setError(null);
    try {
      await markUniformShipped(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menandai kiriman.");
    } finally {
      setShippingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[#E4E6EB] p-4 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">Sekolah</label>
          <select
            value={schoolId}
            disabled={!!lockedSchoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white disabled:opacity-60"
          >
            <option value="">Semua sekolah</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#050505] mb-1">Status kirim</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border border-[#CED0D4] px-3 py-2 text-sm bg-white"
          >
            <option value="belum_dikirim">Belum terkirim</option>
            <option value="sudah_dikirim">Sudah terkirim</option>
            <option value="">Semua</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#050505] mb-1">Cari (nama/NIS/nomor)</label>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Perlu filter sekolah"
              className="flex-1 rounded-xl border border-[#CED0D4] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={load}
              className="px-4 py-2 bg-[#F0F2F5] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98]"
            >
              Cari
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E4E6EB] divide-y divide-[#E4E6EB]">
        {loading && <div className="px-4 py-6 text-center text-xs text-[#65676B]">Memuat…</div>}
        {!loading && rows.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-[#65676B]">
            Tidak ada order pada filter ini. Order baru muncul setelah ortu memesan via portal seragam.
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{r.studentName} <span className="font-normal text-[#65676B]">· {r.nis}</span></div>
              <div className="text-xs text-[#65676B]">{r.orderNumber} · {r.schoolName} · {formatRupiah(r.totalAmount)}</div>
              <div className="text-xs text-[#65676B] truncate">{r.homeAddressSnapshot}</div>
              <div className="mt-1">
                {r.shipmentStatus === "sudah_dikirim" ? (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Terkirim{r.shippedAt ? ` · ${r.shippedAt.slice(0, 10)}` : ""}</span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">Belum terkirim</span>
                )}
              </div>
            </div>
            {r.shipmentStatus === "belum_dikirim" && (
              <button
                type="button"
                disabled={shippingId === r.id}
                onClick={() => handleShip(r.id)}
                className="shrink-0 px-4 py-2 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
              >
                {shippingId === r.id ? "…" : "Tandai Terkirim"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
