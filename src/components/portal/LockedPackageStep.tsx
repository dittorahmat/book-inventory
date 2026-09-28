import { ArrowRight, AlertCircle } from "lucide-react";
import { curriculumLabel } from "../../lib/resolve-package";
import type { StudentSearchResult, BookPackageOption } from "../../lib/portal-types";

interface LockedPackageStepProps {
  student: StudentSearchResult;
  selectedPackage: BookPackageOption | undefined;
  onBack: () => void;
  onNext: () => void;
}

export function LockedPackageStep({ student, selectedPackage, onBack, onNext }: LockedPackageStepProps) {
  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E4E6EB] shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-[#E4E6EB] pb-4">
        <div>
          <div className="text-xs font-bold text-[#1877F2] uppercase tracking-wider">Murid Terpilih</div>
          <h2 className="text-base font-bold text-[#050505]">{student.name}</h2>
          <div className="text-xs text-[#65676B]">
            {student.schoolName} &bull; NIS: {student.nis} &bull; Kelas {student.targetGradeLevel} &bull; {curriculumLabel(student.curriculumType)}
          </div>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-[#65676B] hover:text-[#050505] font-semibold"
        >
          Ubah Murid
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-[#050505] mb-1">Paket Buku Otomatis</h3>
        <p className="text-xs text-[#65676B] mb-4">
          Paket dikunci otomatis mengikuti Kelas {student.targetGradeLevel} Kurikulum {curriculumLabel(student.curriculumType)}. Berikut rincian isi paketnya.
        </p>

        {selectedPackage ? (
          <div className="border-2 border-[#1877F2] bg-[#E7F3FF]/40 rounded-2xl overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-[#050505]">{selectedPackage.name}</span>
                  <span className="text-[10px] font-bold bg-[#1877F2] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Terkunci
                  </span>
                  <span className="text-[10px] font-semibold text-[#65676B] bg-white px-2 py-0.5 rounded-md">
                    {selectedPackage.code}
                  </span>
                </div>
                <div className="text-xs text-[#65676B] mt-1">
                  Terdiri dari {selectedPackage.totalItemsCount} buku &bull; {curriculumLabel(selectedPackage.curriculumType)} &bull; TA {selectedPackage.academicYear}
                </div>
              </div>

              <div className="text-base font-bold text-[#050505] shrink-0">
                Rp {selectedPackage.price.toLocaleString("id-ID")}
              </div>
            </div>

            <div className="bg-white border-t border-[#E4E6EB] divide-y divide-[#E4E6EB]">
              {selectedPackage.items.map((it, idx) => (
                <div key={it.id ?? `${it.bookId ?? "item"}-${idx}`} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#050505] truncate">
                      {idx + 1}. {it.title}
                    </div>
                    {it.isbn && (
                      <div className="text-[11px] font-mono text-[#65676B]">
                        ISBN: {it.isbn}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-[#1877F2] bg-[#E7F3FF] px-2 py-0.5 rounded-md shrink-0">
                    x{it.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center border-2 border-dashed border-[#CED0D4] rounded-2xl bg-[#F7F8FA]">
            <AlertCircle className="w-8 h-8 text-[#65676B] mx-auto" />
            <h4 className="text-sm font-bold text-[#050505] mt-2">Paket Belum Tersedia</h4>
            <p className="text-xs text-[#65676B] mt-1 max-w-sm mx-auto leading-relaxed">
              Paket buku untuk Kelas {student.targetGradeLevel} Kurikulum {curriculumLabel(student.curriculumType)} tahun ajaran ini belum diterbitkan. Silakan hubungi admin sekolah untuk informasi lebih lanjut.
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-[#E4E6EB] flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-[#F0F2F5] text-[#050505] rounded-xl text-xs font-semibold hover:bg-[#E4E6EB] active:scale-[0.98] transition-all"
        >
          {selectedPackage ? "Kembali" : "Ubah Murid"}
        </button>
        {selectedPackage && (
          <button
            type="button"
            onClick={onNext}
            className="px-6 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-2"
          >
            <span>Lanjut ke Pembayaran</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
