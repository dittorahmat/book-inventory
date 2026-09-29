import { useEffect } from "react";
import { SearchX, UserPlus, PencilLine, X } from "lucide-react";

interface NoResultConfirmModalProps {
  query: string;
  onConfirm: () => void;
  onEditKeyword: () => void;
  onCancel: () => void;
}

export function NoResultConfirmModal({
  query,
  onConfirm,
  onEditKeyword,
  onCancel,
}: NoResultConfirmModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="no-result-confirm-title"
        className="w-full max-w-sm bg-white rounded-2xl border border-[#E4E6EB] shadow-xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-11 h-11 rounded-full bg-[#E7F3FF] flex items-center justify-center shrink-0">
            <SearchX className="w-5 h-5 text-[#1877F2]" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup dialog"
            className="p-1.5 text-[#65676B] hover:bg-[#F0F2F5] active:scale-[0.98] rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h2 id="no-result-confirm-title" className="mt-3 text-base font-bold text-[#050505]">
          Siswa Tidak Ditemukan
        </h2>
        <p className="mt-1.5 text-xs text-[#65676B] leading-relaxed">
          Data <span className="font-semibold text-[#050505]">&ldquo;{query}&rdquo;</span> belum
          terdaftar. Pastikan ejaan NIS/nama sudah benar sebelum membuat data baru untuk menghindari
          data ganda.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full px-4 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Buat Siswa Baru</span>
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEditKeyword}
              autoFocus
              className="flex-1 px-4 py-2.5 bg-white border border-[#CED0D4] hover:bg-[#F0F2F5] active:scale-[0.98] text-[#050505] rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <PencilLine className="w-4 h-4 text-[#1877F2]" />
              <span>Ubah Kata Kunci</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-[#F0F2F5] hover:bg-[#E4E6EB] active:scale-[0.98] text-[#050505] rounded-xl text-xs font-semibold transition-all"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
