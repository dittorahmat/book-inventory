import type { SchoolOption } from "../../lib/portal-types";
import type { UniformStudent } from "../../lib/uniform-types";

export interface UniformSearchProps {
  schools: SchoolOption[];
  schoolId: string;
  setSchoolId: (v: string) => void;
  query: string;
  setQuery: (v: string) => void;
  searching: boolean;
  searched: boolean;
  results: UniformStudent[];
  handleSearch: () => void;
  selectStudent: (s: UniformStudent) => void;
  loading: boolean;
}

export function UniformSearchStep({ order }: { order: UniformSearchProps }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E6EB] p-6 sm:p-7 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-[#050505] mb-1">Sekolah</label>
        <select
          value={order.schoolId}
          onChange={(e) => order.setSchoolId(e.target.value)}
          className="w-full rounded-xl border border-[#CED0D4] px-3 py-2.5 text-sm bg-white"
        >
          <option value="">— Pilih sekolah —</option>
          {order.schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#050505] mb-1">Nama atau NIS murid</label>
        <div className="flex gap-2">
          <input
            value={order.query}
            onChange={(e) => order.setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && order.handleSearch()}
            placeholder="Minimal 2 karakter"
            className="flex-1 rounded-xl border border-[#CED0D4] px-3 py-2.5 text-sm"
          />
          <button
            type="button"
            onClick={order.handleSearch}
            disabled={order.searching}
            className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-[#1664D9] active:scale-[0.98]"
          >
            {order.searching ? "Mencari…" : "Cari"}
          </button>
        </div>
      </div>
      {order.searched && order.results.length === 0 && (
        <p className="text-xs text-[#65676B]">Murid tidak ditemukan. Pastikan sekolah benar atau hubungi admin.</p>
      )}
      {order.results.length > 0 && (
        <div className="divide-y divide-[#E4E6EB] rounded-xl border border-[#E4E6EB]">
          {order.results.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => order.selectStudent(s)}
              disabled={order.loading}
              className="w-full text-left px-4 py-3 hover:bg-[#F0F2F5] active:scale-[0.99] disabled:opacity-50"
            >
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="text-xs text-[#65676B]">NIS {s.nis} · Kelas {s.gradeLevel} · {s.schoolName}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
