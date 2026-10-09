import { Search, AlertCircle, CheckCircle2, UploadCloud } from "lucide-react";
import type {
  MatchedOrder,
  PackageBookChoice,
  FileUploadHandler,
} from "../../lib/portal-types";

interface ReturnReportTabProps {
  errorMessage: string | null;
  returnLookupQuery: string;
  setReturnLookupQuery: (val: string) => void;
  isLookingUpReturn: boolean;
  matchedOrders: MatchedOrder[];
  selectedReturnOrder: MatchedOrder | null;
  setSelectedReturnOrder: (val: MatchedOrder | null) => void;
  packageBookList: PackageBookChoice[];
  selectedDefectiveBookId: string;
  setSelectedDefectiveBookId: (val: string) => void;
  returnReason: string;
  setReturnReason: (val: string) => void;
  defectPhotoBase64: string;
  setDefectPhotoBase64: (val: string) => void;
  returnSuccessData: any;
  isSubmitting: boolean;
  onFileUpload: FileUploadHandler;
  onLookupOrder: (e: React.FormEvent) => void;
  onSelectOrder: (order: MatchedOrder) => void;
  onSubmitReturn: (e: React.FormEvent) => void;
  onResetReturn: () => void;
}

export function ReturnReportTab({
  errorMessage,
  returnLookupQuery,
  setReturnLookupQuery,
  isLookingUpReturn,
  matchedOrders,
  selectedReturnOrder,
  setSelectedReturnOrder,
  packageBookList,
  selectedDefectiveBookId,
  setSelectedDefectiveBookId,
  returnReason,
  setReturnReason,
  defectPhotoBase64,
  setDefectPhotoBase64,
  returnSuccessData,
  isSubmitting,
  onFileUpload,
  onLookupOrder,
  onSelectOrder,
  onSubmitReturn,
  onResetReturn,
}: ReturnReportTabProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#050505]">
          Layanan Permohonan Retur & Refund Orang Tua
        </h1>
        <p className="text-xs text-[#65676B] mt-1 max-w-lg mx-auto">
          Buku yang cacat produksi atau permohonan pengembalian dana (refund) dapat diajukan di sini dan diverifikasi oleh tim logistik Gudang Pusat.
        </p>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Perhatian</div>
            <div>{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Success alert */}
      {returnSuccessData ? (
        <div className="bg-white rounded-2xl p-8 border border-[#E4E6EB] shadow-xs text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#050505]">Laporan Retur Berhasil Diajukan!</h2>
          <p className="text-xs text-[#65676B] max-w-md mx-auto">
            Laporan retur buku rusak telah diterima oleh tim logistik sekolah. Silakan membawa buku fisik cacat ke loket logistik untuk ditukar dengan buku baru.
          </p>
          <div className="bg-[#F7F8FA] p-4 rounded-2xl max-w-sm mx-auto text-xs text-left border border-[#E4E6EB] space-y-1">
            <div><span className="text-[#65676B]">ID Laporan:</span> <span className="font-mono font-bold text-[#050505]">{returnSuccessData.returnId}</span></div>
            <div><span className="text-[#65676B]">No. Pesanan:</span> <span className="font-mono font-semibold text-[#050505]">{returnSuccessData.orderNumber}</span></div>
            <div><span className="text-[#65676B]">Status:</span> <span className="font-bold uppercase tracking-wider text-amber-600">Menunggu Verifikasi Loket</span></div>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onResetReturn}
              className="px-5 py-2.5 bg-[#1877F2] active:scale-[0.98] text-white rounded-xl text-xs font-semibold hover:bg-[#166FE5] transition-all"
            >
              Ajukan Laporan Lain
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Search Order for Return */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E4E6EB] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#1877F2] uppercase tracking-wider">Cari Pesanan</span>
            </div>
            <h2 className="text-base font-bold text-[#050505]">
              Langkah 1: Cari Nomor Pesanan Buku atau NIS Siswa
            </h2>
            <p className="text-xs text-[#65676B]">
              Masukkan Nomor Pesanan (contoh: <code className="bg-[#F0F2F5] px-1 py-0.5 rounded">ORD-202609-001</code>) atau NIS Siswa untuk memeriksa riwayat pengambilan buku.
            </p>

            <form onSubmit={onLookupOrder} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" />
                <input
                  type="text"
                  required
                  value={returnLookupQuery}
                  onChange={(e) => setReturnLookupQuery(e.target.value)}
                  placeholder="Ketik No. Pesanan (ORD-...) atau NIS Siswa..."
                  className="w-full pl-10 pr-4 py-3 bg-[#F0F2F5] border border-transparent focus:border-[#1877F2] focus:bg-white rounded-2xl text-xs sm:text-sm text-[#050505] transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isLookingUpReturn}
                className="px-5 py-3 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-2xl text-xs sm:text-sm font-semibold shadow-xs transition-all shrink-0 disabled:opacity-50"
              >
                {isLookingUpReturn ? "Mencari..." : "Temukan Pesanan"}
              </button>
            </form>

            {/* Matched Orders List */}
            {matchedOrders.length > 0 && !selectedReturnOrder && (
              <div className="mt-4 space-y-2">
                <span className="text-xs font-semibold text-[#65676B]">Pilih pesanan yang sesuai:</span>
                <div className="divide-y divide-[#E4E6EB] border border-[#E4E6EB] rounded-2xl overflow-hidden">
                  {matchedOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-4 hover:bg-[#F7F8FA] transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-[#050505]">{ord.orderNumber}</span>
                          <span className="text-xs font-semibold text-[#050505]">{ord.studentName}</span>
                          <span className="text-[10px] font-mono bg-[#F0F2F5] px-1.5 py-0.5 rounded text-[#65676B]">
                            NIS: {ord.nis}
                          </span>
                        </div>
                        <div className="text-xs text-[#65676B] mt-1">
                          {ord.packageName} &bull; Status Fisik: <span className="font-semibold text-[#050505]">{ord.fulfillmentStatus}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectOrder(ord)}
                        className="px-4 py-2 bg-[#E7F3FF] hover:bg-[#D8ECFF] active:scale-[0.98] text-[#1877F2] font-semibold text-xs rounded-xl transition-all shrink-0"
                      >
                        Pilih Pesanan Ini
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Selected Order & Defect Form */}
          {selectedReturnOrder && (
            <form onSubmit={onSubmitReturn} className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E4E6EB] shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-[#E4E6EB] pb-3.5">
                <div>
                  <span className="text-[11px] font-bold text-[#1877F2] uppercase tracking-wider">Langkah 2: Data Kerusakan Buku</span>
                  <h3 className="text-base font-bold text-[#050505] mt-0.5">
                    Pesanan {selectedReturnOrder.orderNumber} ({selectedReturnOrder.studentName})
                  </h3>
                  <p className="text-xs text-[#65676B]">
                    {selectedReturnOrder.schoolName} &bull; Paket: {selectedReturnOrder.packageName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReturnOrder(null)}
                  className="text-xs text-[#65676B] hover:text-[#050505] font-semibold"
                >
                  Ganti Pesanan
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1.5">
                    Pilih Judul Buku yang Cacat / Rusak
                  </label>
                  <select
                    value={selectedDefectiveBookId}
                    onChange={(e) => setSelectedDefectiveBookId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-none focus:border-[#1877F2]"
                    required
                  >
                    {packageBookList.map((bk) => (
                      <option key={bk.bookId} value={bk.bookId}>
                        {bk.title} (ISBN: {bk.isbn})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1.5">
                    Deskripsi Kerusakan Fisik
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Jelaskan secara spesifik kerusakan buku (contoh: Halaman 30 sampai 45 hilang / cetakan buram / sampul robek parah)..."
                    className="w-full px-3.5 py-2.5 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505] focus:outline-none focus:border-[#1877F2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1.5">
                    Foto Bukti Buku Rusak (Wajib Diunggah)
                  </label>
                  <div className="border border-dashed border-[#CED0D4] rounded-xl p-4 text-center bg-[#F7F8FA]">
                    <UploadCloud className="w-6 h-6 text-[#65676B] mx-auto mb-1.5" />
                    <input
                      type="file"
                      accept="image/*"
                      required
                      onChange={(e) => onFileUpload(e, setDefectPhotoBase64)}
                      className="text-xs text-[#65676B] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1877F2] file:text-white hover:file:bg-[#166FE5]"
                    />
                    <p className="text-[10px] text-[#65676B] mt-1">
                      Foto bagian halaman atau sampul yang cacat agar petugas dapat memverifikasi.
                    </p>
                  </div>

                  {defectPhotoBase64 && (
                    <div className="mt-3">
                      <span className="text-[11px] font-semibold text-[#050505]">Preview Bukti Foto:</span>
                      <img
                        src={defectPhotoBase64}
                        alt="Defect proof preview"
                        className="mt-1 h-36 rounded-xl object-contain border border-[#CED0D4] bg-white p-1"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-[#E4E6EB] flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setSelectedReturnOrder(null)}
                  className="px-5 py-2.5 bg-[#F0F2F5] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98] transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <span>{isSubmitting ? "Mengirimkan Laporan..." : "Kirim Pengaduan Retur"}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
