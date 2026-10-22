import { Search, RotateCcw, Info } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import { bookReturnStatus } from "../../lib/book-return";
import type { PortalOrderLookup, SchoolOption } from "../../lib/portal-types";

interface BookReturnSearchStepProps {
  schools: SchoolOption[];
  schoolId: string;
  setSchoolId: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  searching: boolean;
  searched: boolean;
  orders: PortalOrderLookup[];
  error: string | null;
  onSearch: (e: React.FormEvent) => void;
  onSelectOrder: (order: PortalOrderLookup) => void;
}

export function BookReturnSearchStep({
  schools,
  schoolId,
  setSchoolId,
  query,
  setQuery,
  searching,
  searched,
  orders,
  error,
  onSearch,
  onSelectOrder,
}: BookReturnSearchStepProps) {
  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E4E6EB] shadow-xs">
      <span className="text-[11px] font-bold text-[#1877F2] uppercase tracking-wider">Cari Pesanan</span>
      <h2 className="text-base sm:text-lg font-bold text-[#050505] mt-1">Temukan Pesanan Buku Anak Anda</h2>
      <p className="text-xs text-[#65676B] mt-1 leading-relaxed">
        Pilih cabang, lalu masukkan NIS, nama siswa, atau nomor pesanan untuk memuat buku yang sudah diterima.
      </p>

      <form onSubmit={onSearch} className="mt-4 space-y-3">
        <SearchableSingleSelect
          label="Cabang / Sekolah"
          options={schools.map((s) => ({ value: s.id, label: s.name, hint: s.code }))}
          value={schoolId}
          onChange={setSchoolId}
          placeholder="Pilih cabang..."
          required
        />
        <div>
          <label htmlFor="book-return-query" className="block text-xs font-semibold text-[#050505] mb-1">
            NIS, Nama Siswa, atau No. Pesanan
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
              <input
                id="book-return-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Contoh: 20241001 atau ORD-202610-0007"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#CED0D4] focus:border-[#1877F2] rounded-xl text-xs sm:text-sm text-[#050505] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !schoolId || query.trim().length < 3}
              className="px-5 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? "Mencari..." : "Cari Pesanan"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div role="alert" className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {error}
        </div>
      )}

      {searched && orders.length === 0 && !error && (
        <div className="mt-5 p-4 bg-[#F0F2F5] border border-[#E4E6EB] rounded-xl flex items-start gap-3">
          <Info className="w-4 h-4 text-[#65676B] shrink-0 mt-0.5" />
          <div className="text-xs text-[#65676B]">
            <div className="font-semibold text-[#050505]">Pesanan tidak ditemukan</div>
            <p className="mt-0.5">Periksa kembali NIS, nama, atau nomor pesanan. Pastikan cabang yang dipilih benar.</p>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-5">
          <div className="text-xs font-semibold text-[#65676B] mb-2">
            Ditemukan {orders.length} pesanan:
          </div>
          <div className="divide-y divide-[#E4E6EB] border border-[#E4E6EB] rounded-xl overflow-hidden">
            {orders.map((order) => {
              const status = bookReturnStatus(order.fulfillmentStatus);
              return (
                <div
                  key={order.id}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#F7F8FA] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#050505] truncate">{order.studentName}</span>
                      <span className="text-[11px] font-mono text-[#65676B] bg-[#F0F2F5] px-2 py-0.5 rounded-md">
                        {order.orderNumber}
                      </span>
                    </div>
                    <div className="text-xs text-[#65676B] mt-1 flex items-center gap-2 flex-wrap">
                      <span>NIS {order.nis}</span>
                      {order.packageName && (
                        <>
                          <span>&bull;</span>
                          <span>{order.packageName}</span>
                        </>
                      )}
                    </div>
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full mt-1.5 ${status.cls}`}
                    >
                      {status.text}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectOrder(order)}
                    disabled={!status.returnable}
                    title={status.blockedReason ?? undefined}
                    className="px-3.5 py-1.5 bg-[#E7F3FF] hover:bg-[#D8ECFF] active:scale-[0.98] text-[#1877F2] font-semibold text-xs rounded-lg transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Ajukan Refund</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
