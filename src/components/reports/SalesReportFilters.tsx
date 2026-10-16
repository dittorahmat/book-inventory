import { SearchableSingleSelect } from "../ui/SearchableSingleSelect";
import type { School } from "../../types";

interface FiltersProps {
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  schoolId: string;
  setSchoolId: (v: string) => void;
  schools: School[];
  lockedSchoolId?: string | null;
  gradeLevel: string;
  setGradeLevel: (v: string) => void;
  gender: string;
  setGender: (v: string) => void;
  paymentStatus: string;
  setPaymentStatus: (v: string) => void;
  fulfillmentStatus: string;
  setFulfillmentStatus: (v: string) => void;
}

const inputClass =
  "px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]";

/** Filter laporan buku: periode, cabang, kelas, ikhwan/akhwat, bayar, terbagi. */
export function SalesReportFilters(p: FiltersProps) {
  const isLocked = !!p.lockedSchoolId;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-[#E4E6EB]">
      <div>
        <label className="block text-xs font-semibold text-[#050505] mb-1">Dari Tanggal</label>
        <input type="date" className={`${inputClass} w-full`} value={p.from} onChange={(e) => p.setFrom(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#050505] mb-1">Sampai Tanggal</label>
        <input type="date" className={`${inputClass} w-full`} value={p.to} onChange={(e) => p.setTo(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#050505] mb-1">Sekolah</label>
        {isLocked ? (
          <div className={`${inputClass} bg-[#F0F2F5] text-[#65676B]`}>
            {p.schools.find((s) => s.id === p.lockedSchoolId)?.name ?? "Sekolah Anda"}
          </div>
        ) : (
          <SearchableSingleSelect
            options={p.schools.map((s) => ({ value: s.id, label: s.name }))}
            value={p.schoolId}
            onChange={p.setSchoolId}
            placeholder="Semua Sekolah"
          />
        )}
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#050505] mb-1">Kelas</label>
        <input value={p.gradeLevel} onChange={(e) => p.setGradeLevel(e.target.value)} placeholder="Semua (mis. 1)" className={`${inputClass} w-full`} />
      </div>
      <div>
        <SearchableSingleSelect
          label="Ikhwan / Akhwat"
          options={[
            { value: "", label: "Semua" },
            { value: "male", label: "Ikhwan" },
            { value: "female", label: "Akhwat" },
          ]}
          value={p.gender}
          onChange={p.setGender}
          placeholder="Semua"
        />
      </div>
      <div>
        <SearchableSingleSelect
          label="Status Bayar"
          options={[
            { value: "", label: "Semua" },
            { value: "unpaid", label: "Belum bayar" },
            { value: "partial", label: "Cicilan" },
            { value: "paid", label: "Lunas" },
          ]}
          value={p.paymentStatus}
          onChange={p.setPaymentStatus}
          placeholder="Semua"
        />
      </div>
      <div>
        <SearchableSingleSelect
          label="Status Bagi"
          options={[
            { value: "", label: "Semua" },
            { value: "waiting_preparation", label: "Belum terbagi" },
            { value: "picked_up", label: "Sudah terbagi" },
          ]}
          value={p.fulfillmentStatus}
          onChange={p.setFulfillmentStatus}
          placeholder="Semua"
        />
      </div>
    </div>
  );
}
