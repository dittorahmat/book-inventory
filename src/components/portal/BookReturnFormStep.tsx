import { ArrowLeft, ImagePlus, RotateCcw, Loader2 } from "lucide-react";
import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { BookReturnFormApi } from "./useBookReturn";
import type { PortalOrderLookup } from "../../lib/portal-types";

interface BookReturnFormStepProps {
  order: PortalOrderLookup;
  /** State + aksi form; satu objek agar field baru tidak mengubah 3 berkas. */
  form: BookReturnFormApi;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export function BookReturnFormStep({ order, form, error, onSubmit, onBack }: BookReturnFormStepProps) {
  const {
    bookChoices,
    booksLoading,
    booksError,
    selectedBookId,
    setSelectedBookId,
    reason,
    setReason,
    photoBase64,
    handlePhoto,
    submitting,
    isWithdrawal,
    setIsWithdrawal,
  } = form;

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E4E6EB] shadow-xs space-y-5">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E4E6EB]">
        <div className="min-w-0">
          <span className="text-[11px] font-bold text-[#1877F2] uppercase tracking-wider">Pesanan Dipilih</span>
          <div className="text-sm font-bold text-[#050505] mt-1 truncate">{order.studentName}</div>
          <div className="text-xs text-[#65676B] mt-0.5">
            NIS {order.nis} &bull; {order.orderNumber}
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-[#1877F2] hover:underline shrink-0 flex items-center gap-1 active:scale-[0.98]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Ganti Pesanan
        </button>
      </div>

      <div className="p-3 bg-[#F7F8FA] border border-[#E4E6EB] rounded-xl flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-[#050505] block">Siswa Mengundurkan Diri?</span>
          <span className="text-[11px] text-[#65676B] block">Batalkan seluruh pesanan buku dan unassign stok</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isWithdrawal}
            onChange={(e) => setIsWithdrawal(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1877F2]"></div>
        </label>
      </div>

      {!isWithdrawal && (
        booksLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#65676B]">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat daftar buku...
          </div>
        ) : booksError ? (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {booksError}
          </div>
        ) : (
          <SearchableSingleSelect
            label="Judul Buku yang Dikembalikan"
            options={bookChoices.map((b) => ({ value: b.bookId, label: b.title }))}
            value={selectedBookId}
            onChange={setSelectedBookId}
            placeholder="Pilih judul buku..."
            required
          />
        )
      )}

      <div>
        <label htmlFor="book-return-reason" className="block text-xs font-semibold text-[#050505] mb-1">
          {isWithdrawal ? "Alasan Siswa Mengundurkan Diri" : "Alasan Pengembalian"} <span className="text-red-600">*</span>
        </label>
        <textarea
          id="book-return-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            isWithdrawal
              ? "Contoh: Pindah sekolah ke luar kota / domisili keluarga."
              : "Contoh: halaman 15-22 sobek, cetakan buram, atau buku salah kirim."
          }
          className="w-full px-3 py-2.5 bg-white border border-[#CED0D4] focus:border-[#1877F2] rounded-xl text-xs sm:text-sm text-[#050505] transition-colors"
        />
      </div>

      <div>
        <span className="block text-xs font-semibold text-[#050505] mb-1">
          {isWithdrawal ? "Surat Pengunduran Diri Resmi" : "Foto Kondisi Fisik Buku"} <span className="text-red-600">*</span>
        </span>
        <div className="flex items-center gap-3">
          <label
            htmlFor="book-return-photo"
            className="px-4 py-2 bg-white border border-[#CED0D4] hover:bg-[#F0F2F5] active:scale-[0.98] text-[#050505] text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ImagePlus className="w-4 h-4 text-[#1877F2]" />
            <span>{photoBase64 ? (isWithdrawal ? "Ganti Dokumen" : "Ganti Foto") : (isWithdrawal ? "Unggah Dokumen" : "Unggah Foto")}</span>
          </label>
          <input
            id="book-return-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={isWithdrawal ? "Surat pengunduran diri" : "Foto kondisi fisik buku"}
            onChange={handlePhoto}
            className="sr-only"
          />
          {photoBase64 && (
            <img
              src={photoBase64}
              alt={isWithdrawal ? "Pratinjau surat pengunduran diri" : "Pratinjau foto bukti kondisi buku"}
              className="h-16 w-16 object-cover rounded-xl border border-[#E4E6EB]"
            />
          )}
        </div>
        <p className="text-[11px] text-[#65676B] mt-1.5">
          {isWithdrawal
            ? "Unggah foto/scan surat pernyataan pengunduran diri siswa. Maksimal 2 MB (JPG/PNG/WebP)."
            : "Foto jelas bagian buku yang rusak. Maksimal 2 MB (JPG/PNG/WebP)."}
        </p>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          <span>{submitting ? "Mengirim..." : isWithdrawal ? "Kirim Pembatalan Siswa Mundur" : "Kirim Pengajuan Refund"}</span>
        </button>
      </div>
    </form>
  );
}
