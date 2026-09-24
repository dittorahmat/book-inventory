import { useState, useEffect, useCallback } from "react";
import { School } from "../types";
import { 
  Search, 
  RefreshCw, 
  X, 
  Layers
} from "lucide-react";

interface BookReturn {
  id: string;
  orderId: string;
  orderNumber: string;
  studentId: string;
  studentName: string;
  nis: string;
  defectiveBookId: string;
  bookTitle: string;
  isbn: string;
  reason: string;
  photoProofUrl?: string;
  status: "reported" | "approved" | "replaced" | "rejected";
  replacementBookItemId?: string;
  resolvedAt?: string;
  createdAt: string;
}

interface BookReturnsViewProps {
  activeSchool: School | null;
}

export function BookReturnsView({ activeSchool }: BookReturnsViewProps) {
  const [returns, setReturns] = useState<BookReturn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeReturn, setActiveReturn] = useState<BookReturn | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReturns = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/student-orders/returns");
      const data = await res.json();
      if (data.success) {
        setReturns(data.data);
      }
    } catch (err) {
      console.error("Failed to load book returns", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  const handleResolve = async (action: "replace" | "reject") => {
    if (!activeReturn) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/student-orders/returns/${activeReturn.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Gagal memproses penggantian");
      setActiveReturn(null);
      loadReturns();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = returns.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.studentName.toLowerCase().includes(q) ||
      r.bookTitle.toLowerCase().includes(q) ||
      r.orderNumber.toLowerCase().includes(q) ||
      r.nis.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 border border-[#E4E6EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              Komplain & Retur
            </span>
            <span className="text-xs text-[#65676B]">&bull; {activeSchool?.name || "Pilih Cabang"}</span>
          </div>
          <h1 className="text-xl font-bold text-[#050505] tracking-tight mt-1">
            Penanganan Retur Buku Cacat / Rusak
          </h1>
          <p className="text-xs text-[#65676B] max-w-2xl mt-0.5">
            Laporan murid terkait buku rusak fisik/halaman sobek dengan lampiran foto bukti dan alur tukar buku baru dari stok satuan.
          </p>
        </div>

        <button
          onClick={() => loadReturns()}
          className="p-2.5 rounded-xl border border-[#CED0D4] hover:bg-[#F0F2F5] text-[#65676B] transition-colors shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
          <input
            type="text"
            placeholder="Cari murid, judul buku, no. pesanan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] placeholder-[#65676B] focus:outline-hidden focus:border-[#1877F2]"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F8FA] border-b border-[#E4E6EB] text-[#65676B] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Murid & No. Pesanan</th>
                <th className="py-3 px-4">Buku yang Rusak</th>
                <th className="py-3 px-4">Alasan Cacat</th>
                <th className="py-3 px-4">Status Retur</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EB]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#65676B]">
                    Memuat data retur...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#65676B]">
                    Tidak ada laporan buku retur yang ditemukan.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#050505]">{r.studentName}</div>
                      <div className="text-[11px] text-[#65676B]">
                        NIS: {r.nis} &bull; <span className="font-mono text-[10px] text-[#1877F2]">{r.orderNumber}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-[#050505]">{r.bookTitle}</div>
                      <div className="text-[10px] font-mono text-[#65676B]">ISBN: {r.isbn}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-[#050505] max-w-xs truncate">{r.reason}</div>
                      {r.photoProofUrl && (
                        <a
                          href={r.photoProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-[#1877F2] hover:underline block mt-0.5"
                        >
                          Lihat Foto Bukti &rarr;
                        </a>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {r.status === "reported" && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          MENUNGGU PERIKSA
                        </span>
                      )}
                      {r.status === "replaced" && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          SUDAH DIGANTI BARU
                        </span>
                      )}
                      {r.status === "rejected" && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-50 text-red-700 border border-red-200">
                          DITOLAK
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {r.status === "reported" && (
                        <button
                          onClick={() => setActiveReturn(r)}
                          className="px-3 py-1.5 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-xl text-xs transition-colors shadow-2xs"
                        >
                          Tindak Lanjut
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RESOLVE RETURN MODAL */}
      {activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E4E6EB] max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E6EB] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#050505]">Pemeriksaan Penggantian Buku Cacat</h3>
              <button onClick={() => setActiveReturn(null)} className="text-[#65676B] hover:text-[#050505]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <span className="text-[#65676B]">Murid:</span>{" "}
                <span className="font-bold text-[#050505]">{activeReturn.studentName}</span>
              </div>
              <div>
                <span className="text-[#65676B]">Buku Cacat:</span>{" "}
                <span className="font-semibold text-[#050505]">{activeReturn.bookTitle}</span>
              </div>
              <div>
                <span className="text-[#65676B]">Keterangan Kerusakan:</span>
                <p className="p-3 bg-[#F0F2F5] rounded-xl text-[#050505] mt-1">{activeReturn.reason}</p>
              </div>
              {activeReturn.photoProofUrl && (
                <div>
                  <span className="font-semibold block mb-1">Foto Bukti Kerusakan:</span>
                  <img
                    src={activeReturn.photoProofUrl}
                    alt="Bukti cacat"
                    className="h-40 w-full object-contain rounded-xl border border-[#E4E6EB] bg-gray-50 p-1"
                  />
                </div>
              )}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleResolve("reject")}
                  className="px-4 py-2 bg-red-50 text-red-700 rounded-xl font-semibold hover:bg-red-100"
                >
                  Tolak Retur
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleResolve("replace")}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Ganti Buku Baru (Dari Stok Loose)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
