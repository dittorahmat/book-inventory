import { Trash2 } from "lucide-react";
import type { School } from "../../types";

export interface BookOption {
  id: string;
  title: string;
  price: number;
}

export interface AllocationItem {
  id?: string;
  bookId: string;
  bookTitle?: string | null;
  bookPrice?: number | null;
  teacherName: string;
  gradeLevel: string;
  rombel: string;
  subject: string;
  quantity: number;
}

interface TeacherHandbookFormProps {
  editingOrderId: string | null;
  isCentralAdmin: boolean;
  schools: School[];
  schoolId: string;
  onSchoolIdChange: (id: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  allocations: AllocationItem[];
  onAllocationsChange: React.Dispatch<React.SetStateAction<AllocationItem[]>>;
  books: BookOption[];
  formError: string | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  emptyAllocation: () => AllocationItem;
}

export function TeacherHandbookForm({
  editingOrderId,
  isCentralAdmin,
  schools,
  schoolId,
  onSchoolIdChange,
  notes,
  onNotesChange,
  allocations,
  onAllocationsChange,
  books,
  formError,
  isSubmitting,
  onCancel,
  onSubmit,
  emptyAllocation,
}: TeacherHandbookFormProps) {
  return (
    <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
      <h3 className="font-semibold text-slate-900">
        {editingOrderId ? "Revisi Pesanan Pegangan Guru" : "Buat Pesanan Pegangan Guru"}
      </h3>

      {formError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {formError}
        </div>
      )}

      {isCentralAdmin && !editingOrderId && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sekolah Cabang</label>
          <select
            value={schoolId}
            onChange={(e) => onSchoolIdChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Catatan Pesanan</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Contoh: Kebutuhan guru semester ganjil"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Alokasi Guru</span>
          <button
            type="button"
            onClick={() => onAllocationsChange((prev) => [...prev, emptyAllocation()])}
            className="text-xs font-medium text-emerald-700 hover:underline"
          >
            + Tambah Baris Guru
          </button>
        </div>

        {allocations.map((alloc, idx) => (
          <div key={idx} className="grid grid-cols-1 sm:grid-cols-6 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <select
              value={alloc.bookId}
              onChange={(e) =>
                onAllocationsChange((prev) =>
                  prev.map((item, i) => (i === idx ? { ...item, bookId: e.target.value } : item))
                )
              }
              className="sm:col-span-2 rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="">-- Pilih Buku --</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Nama Guru *"
              value={alloc.teacherName}
              onChange={(e) =>
                onAllocationsChange((prev) =>
                  prev.map((item, i) => (i === idx ? { ...item, teacherName: e.target.value } : item))
                )
              }
              className="rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
            />
            <input
              type="text"
              placeholder="Kelas / Rombel"
              value={alloc.gradeLevel}
              onChange={(e) =>
                onAllocationsChange((prev) =>
                  prev.map((item, i) => (i === idx ? { ...item, gradeLevel: e.target.value } : item))
                )
              }
              className="rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
            />
            <input
              type="text"
              placeholder="Mapel"
              value={alloc.subject}
              onChange={(e) =>
                onAllocationsChange((prev) =>
                  prev.map((item, i) => (i === idx ? { ...item, subject: e.target.value } : item))
                )
              }
              className="rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                value={alloc.quantity}
                onChange={(e) =>
                  onAllocationsChange((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, quantity: Math.max(1, Number(e.target.value) || 1) } : item
                    )
                  )
                }
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
              />
              {allocations.length > 1 && (
                <button
                  type="button"
                  onClick={() => onAllocationsChange((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  aria-label="Hapus baris"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          {isSubmitting ? "Menyimpan..." : "Simpan Pesanan"}
        </button>
      </div>
    </form>
  );
}
