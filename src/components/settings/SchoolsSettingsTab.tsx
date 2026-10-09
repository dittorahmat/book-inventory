import { useState } from "react";
import { Plus } from "lucide-react";
import type { School } from "../../types";

interface SchoolsSettingsTabProps {
  schoolsList: School[];
  onSchoolsUpdated?: () => void;
  createSchool: (data: {
    name: string;
    code: string;
    type: "main" | "branch" | "warehouse";
    address: string;
    phone: string;
  }) => Promise<void>;
}

export function SchoolsSettingsTab({
  schoolsList,
  onSchoolsUpdated,
  createSchool,
}: SchoolsSettingsTabProps) {
  const [isAddingSchool, setIsAddingSchool] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolType, setSchoolType] = useState<"main" | "branch" | "warehouse">("branch");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSchool({
        name: schoolName,
        code: schoolCode,
        type: schoolType,
        address: schoolAddress,
        phone: schoolPhone,
      });
      setIsAddingSchool(false);
      setSchoolName("");
      setSchoolCode("");
      setSchoolAddress("");
      setSchoolPhone("");
      if (onSchoolsUpdated) onSchoolsUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error creating school");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-[#65676B]">
          Daftar Cabang Sekolah Terdaftar
        </span>
        <button
          type="button"
          onClick={() => setIsAddingSchool(!isAddingSchool)}
          className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-xs active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          {isAddingSchool ? "Batal" : "Tambah Cabang Baru"}
        </button>
      </div>

      {isAddingSchool && (
        <div className="bg-white border border-[#CED0D4] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="text-sm font-bold text-[#050505] border-b border-[#E4E6EB] pb-3">
            Registrasi Kampus / Cabang Baru
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Nama Sekolah *</label>
              <input
                type="text"
                required
                placeholder="Contoh: Al Wildan 5 (Islamic School)"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Kode Cabang *</label>
              <input
                type="text"
                required
                placeholder="Contoh: ALW-05"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs font-mono focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Tipe *</label>
              <select
                value={schoolType}
                onChange={(e) => setSchoolType(e.target.value as "main" | "branch" | "warehouse")}
                className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs font-semibold focus:outline-hidden focus:border-[#1877F2]"
              >
                <option value="branch">Branch (Cabang)</option>
                <option value="main">Headquarters (Pusat / Central HQ)</option>
                <option value="warehouse">Warehouse (Gudang Logistik)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Nomor Telepon</label>
              <input
                type="text"
                placeholder="Contoh: +62 21 5550105"
                value={schoolPhone}
                onChange={(e) => setSchoolPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#050505] mb-1">Alamat Lengkap</label>
              <input
                type="text"
                placeholder="Contoh: Jl. Raya Sudirman No. 100, Tangerang"
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2.5 pt-3 border-t border-[#E4E6EB]">
              <button
                type="button"
                onClick={() => setIsAddingSchool(false)}
                className="px-4 py-2 bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] rounded-lg text-xs font-semibold transition-colors active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg text-xs font-bold transition-colors shadow-xs active:scale-[0.98]"
              >
                Simpan Sekolah
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-[#E4E6EB] rounded-xl shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F0F2F5] border-b border-[#E4E6EB] text-[#65676B] text-[11px] font-bold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">KODE</th>
              <th className="py-3 px-4">NAMA CABANG</th>
              <th className="py-3 px-4">TIPE</th>
              <th className="py-3 px-4">ALAMAT</th>
              <th className="py-3 px-4">TELEPON</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {schoolsList.map((s) => (
              <tr key={s.id} className="hover:bg-[#F0F2F5]/60 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-[#1877F2]">{s.code}</td>
                <td className="py-3 px-4 font-semibold text-[#050505] flex items-center gap-2">
                  {s.name}
                  {s.type === "main" && (
                    <span className="bg-[#E7F3FF] text-[#1877F2] text-[10px] px-2 py-0.5 rounded-full font-bold">
                      HQ
                    </span>
                  )}
                  {s.type === "warehouse" && (
                    <span className="bg-[#FFF4E5] text-[#B45309] text-[10px] px-2 py-0.5 rounded-full font-bold">
                      GUDANG
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 uppercase text-xs font-semibold text-[#65676B]">{s.type}</td>
                <td className="py-3 px-4 text-[#65676B]">{s.address || "-"}</td>
                <td className="py-3 px-4 text-[#65676B] font-mono text-[11px]">{s.phone || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
