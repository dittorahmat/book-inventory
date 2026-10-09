import { useState } from "react";
import { Plus } from "lucide-react";
import type { School, User } from "../../types";
import type { NewUserInput } from "./useSettingsData";

interface UsersSettingsTabProps {
  usersList: User[];
  schoolsList: School[];
  createUser: (data: NewUserInput) => Promise<void>;
}

export function UsersSettingsTab({
  usersList,
  schoolsList,
  createUser,
}: UsersSettingsTabProps) {
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("password123");
  const [userRole, setUserRole] = useState<"central_admin" | "warehouse_admin" | "school_admin" | "branch_admin">("branch_admin");
  const [userSchoolId, setUserSchoolId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === "branch_admin" && !userSchoolId) {
      alert("Branch administrator must be assigned to a specific school");
      return;
    }

    try {
      await createUser({
        name: userName,
        email: userEmail,
        password: userPassword,
        role: userRole,
        schoolId: userRole === "central_admin" ? undefined : userSchoolId,
      });
      setIsAddingUser(false);
      setUserName("");
      setUserEmail("");
      setUserPassword("password123");
      setUserRole("branch_admin");
      setUserSchoolId("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error creating user");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-[#65676B]">
          Staf Administrator Terotorisasi
        </span>
        <button
          type="button"
          onClick={() => setIsAddingUser(!isAddingUser)}
          className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-xs active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          {isAddingUser ? "Batal" : "Tambah Akun Staf"}
        </button>
      </div>

      {isAddingUser && (
        <div className="bg-white border border-[#CED0D4] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="text-sm font-bold text-[#050505] border-b border-[#E4E6EB] pb-3">
            Buat Akun Staf Baru
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Nama Lengkap *</label>
              <input
                type="text"
                required
                placeholder="Contoh: Ustadz Ahmad Fauzi"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Alamat Email *</label>
              <input
                type="email"
                required
                placeholder="Contoh: fauzi@alwildan.sch.id"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Password Sementara *</label>
              <input
                type="password"
                required
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-hidden focus:border-[#1877F2]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Peran / Role *</label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin")}
                className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs font-semibold focus:outline-hidden focus:border-[#1877F2]"
              >
                <option value="school_admin">Admin Sekolah</option>
                <option value="warehouse_admin">Admin Gudang (Gudang Logistik)</option>
                <option value="branch_admin">Branch Admin (Admin Cabang)</option>
                <option value="central_admin">Central Admin (Admin Pusat HQ)</option>
              </select>
            </div>
            {userRole !== "central_admin" && (
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#050505] mb-1">
                  Cabang Sekolah yang Ditugaskan *
                </label>
                <select
                  required
                  value={userSchoolId}
                  onChange={(e) => setUserSchoolId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs font-semibold focus:outline-hidden focus:border-[#1877F2]"
                >
                  <option value="">-- Pilih Cabang Penugasan --</option>
                  {schoolsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) - {s.type.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="md:col-span-2 flex justify-end gap-2.5 pt-3 border-t border-[#E4E6EB]">
              <button
                type="button"
                onClick={() => setIsAddingUser(false)}
                className="px-4 py-2 bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] rounded-lg text-xs font-semibold transition-colors active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg text-xs font-bold transition-colors shadow-xs active:scale-[0.98]"
              >
                Buat Akun Staf
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-[#E4E6EB] rounded-xl shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F0F2F5] border-b border-[#E4E6EB] text-[#65676B] text-[11px] font-bold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">NAMA</th>
              <th className="py-3 px-4">EMAIL</th>
              <th className="py-3 px-4">PERAN</th>
              <th className="py-3 px-4">PENUGASAN CABANG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {usersList.map((u) => (
              <tr key={u.id} className="hover:bg-[#F0F2F5]/60 transition-colors">
                <td className="py-3 px-4 font-semibold text-[#050505]">{u.name}</td>
                <td className="py-3 px-4 text-[#65676B]">{u.email}</td>
                <td className="py-3 px-4">
                  {u.role === "central_admin" ? (
                    <span className="bg-[#E7F3FF] text-[#1877F2] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                      CENTRAL ADMIN
                    </span>
                  ) : u.role === "warehouse_admin" ? (
                    <span className="bg-[#FFF4E5] text-[#B45309] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                      ADMIN GUDANG
                    </span>
                  ) : u.role === "school_admin" ? (
                    <span className="bg-[#E6F9EC] text-[#0E7A3D] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                      ADMIN SEKOLAH
                    </span>
                  ) : (
                    <span className="bg-[#F0F2F5] text-[#050505] border border-[#CED0D4] px-2.5 py-0.5 rounded-full text-[10px] font-semibold">
                      BRANCH ADMIN
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-[#65676B] font-medium">
                  {u.school ? `${u.school.name} (${u.school.code})` : "Semua Cabang (Global Access)"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
