import { useState, useEffect } from "react";
import { School, User } from "../types";
import { Building2, Users, Plus, Mail, CheckCircle2, RefreshCw } from "lucide-react";

interface SettingsViewProps {
  currentUser?: any;
  onSchoolsUpdated?: () => void;
}

export function SettingsView({ onSchoolsUpdated }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"schools" | "users" | "smtp">("schools");
  const [schoolsList, setSchoolsList] = useState<School[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);

  // New School Form State
  const [isAddingSchool, setIsAddingSchool] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolType, setSchoolType] = useState<"main" | "branch">("branch");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");

  // New User Form State
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("password123");
  const [userRole, setUserRole] = useState<"central_admin" | "branch_admin">("branch_admin");
  const [userSchoolId, setUserSchoolId] = useState("");

  const fetchData = async () => {
    try {
      const [resSchools, resUsers] = await Promise.all([
        fetch("/api/schools").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
      ]);
      if (resSchools.success) setSchoolsList(resSchools.data);
      if (resUsers.success) setUsersList(resUsers.data);
    } catch (err) {
      console.error("Failed to load settings data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: schoolName,
          code: schoolCode,
          type: schoolType,
          address: schoolAddress,
          phone: schoolPhone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddingSchool(false);
        setSchoolName("");
        setSchoolCode("");
        setSchoolAddress("");
        setSchoolPhone("");
        fetchData();
        if (onSchoolsUpdated) onSchoolsUpdated();
      } else {
        alert(data.message || "Failed to create school");
      }
    } catch {
      alert("Error creating school");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === "branch_admin" && !userSchoolId) {
      alert("Branch administrator must be assigned to a specific school");
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          password: userPassword,
          role: userRole,
          schoolId: userSchoolId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddingUser(false);
        setUserName("");
        setUserEmail("");
        setUserPassword("password123");
        setUserSchoolId("");
        fetchData();
      } else {
        alert(data.message || "Failed to create user");
      }
    } catch {
      alert("Error creating user");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Subtabs */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-4 sm:p-5 bg-white rounded-xl border border-[#E4E6EB] shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-[#050505]">
            Organization & System Settings
          </h2>
          <p className="text-xs text-[#65676B] mt-0.5">
            Kelola cabang sekolah, hierarki kampus, dan hak akses staf administrator
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#F0F2F5] p-1.5 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab("schools")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "schools"
                ? "bg-white text-[#1877F2] font-bold shadow-xs"
                : "text-[#65676B] hover:text-[#050505]"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Cabang Sekolah ({schoolsList.length})
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "users"
                ? "bg-white text-[#1877F2] font-bold shadow-xs"
                : "text-[#65676B] hover:text-[#050505]"
            }`}
          >
            <Users className="w-4 h-4" />
            Akun Staf ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab("smtp")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === "smtp"
                ? "bg-white text-[#1877F2] font-bold shadow-xs"
                : "text-[#65676B] hover:text-[#050505]"
            }`}
          >
            <Mail className="w-4 h-4" />
            Email SMTP
          </button>
        </div>
      </div>

      {/* 1. School Hierarchy Tab */}
      {activeTab === "schools" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#65676B]">
              Daftar Cabang Sekolah Terdaftar
            </span>
            <button
              onClick={() => setIsAddingSchool(!isAddingSchool)}
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {isAddingSchool ? "Batal" : "Tambah Cabang Baru"}
            </button>
          </div>

          {/* New School Modal/Inline Form */}
          {isAddingSchool && (
            <div className="bg-white border border-[#CED0D4] rounded-2xl p-6 shadow-xl space-y-4">
              <div className="text-sm font-bold text-[#050505] border-b border-[#E4E6EB] pb-3">
                Registrasi Kampus / Cabang Baru
              </div>
              <form onSubmit={handleCreateSchool} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1">Nama Sekolah *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Al Wildan 5 (Islamic School)"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
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
                    className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs font-mono focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1">Tipe *</label>
                  <select
                    value={schoolType}
                    onChange={(e) => setSchoolType(e.target.value as "main" | "branch")}
                    className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  >
                    <option value="branch">Branch (Cabang)</option>
                    <option value="main">Headquarters (Pusat / Central HQ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1">Nomor Telepon</label>
                  <input
                    type="text"
                    placeholder="Contoh: +62 21 5550105"
                    value={schoolPhone}
                    onChange={(e) => setSchoolPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-[#050505] mb-1">Alamat Lengkap</label>
                  <input
                    type="text"
                    placeholder="Contoh: Jl. Raya Sudirman No. 100, Tangerang"
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end gap-2.5 pt-3 border-t border-[#E4E6EB]">
                  <button
                    type="button"
                    onClick={() => setIsAddingSchool(false)}
                    className="px-4 py-2 bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] rounded-lg text-xs font-semibold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                  >
                    Simpan Sekolah
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Schools Table */}
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
      )}

      {/* 2. Staff Accounts Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#65676B]">
              Staf Administrator Terotorisasi
            </span>
            <button
              onClick={() => setIsAddingUser(!isAddingUser)}
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {isAddingUser ? "Batal" : "Tambah Akun Staf"}
            </button>
          </div>

          {/* New User Form */}
          {isAddingUser && (
            <div className="bg-white border border-[#CED0D4] rounded-2xl p-6 shadow-xl space-y-4">
              <div className="text-sm font-bold text-[#050505] border-b border-[#E4E6EB] pb-3">
                Buat Akun Staf Baru
              </div>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ustadz Ahmad Fauzi"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
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
                    className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1">Password Sementara *</label>
                  <input
                    type="password"
                    required
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#050505] mb-1">Peran / Role *</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as "central_admin" | "branch_admin")}
                    className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  >
                    <option value="branch_admin">Branch Admin (Admin Cabang)</option>
                    <option value="central_admin">Central Admin (Admin Pusat HQ)</option>
                  </select>
                </div>
                {userRole === "branch_admin" && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-[#050505] mb-1">
                      Cabang Sekolah yang Ditugaskan *
                    </label>
                    <select
                      required
                      value={userSchoolId}
                      onChange={(e) => setUserSchoolId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-[#CED0D4] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
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
                    className="px-4 py-2 bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] rounded-lg text-xs font-semibold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                  >
                    Buat Akun Staf
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users Table */}
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
      )}

      {/* 3. SMTP Settings Tab */}
      {activeTab === "smtp" && (
        <SmtpSettingsSection />
      )}
    </div>
  );
}

function SmtpSettingsSection() {
  const [host, setHost] = useState("smtp.gmail.com");
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("Al Wildan School Logistics");
  const [fromEmail, setFromEmail] = useState("logistics@alwildan.sch.id");
  const [testRecipient, setTestRecipient] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/smtp")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setHost(data.data.host || "smtp.gmail.com");
          setPort(data.data.port || 587);
          setSecure(data.data.secure || false);
          setUsername(data.data.username || "");
          setFromName(data.data.fromName || "Al Wildan School Logistics");
          setFromEmail(data.data.fromEmail || "logistics@alwildan.sch.id");
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port,
          secure,
          username,
          password: password || undefined,
          fromName,
          fromEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Gagal menyimpan");
      setMessage("Konfigurasi server SMTP berhasil disimpan.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testRecipient) {
      alert("Masukkan alamat email tujuan uji coba");
      return;
    }
    setIsTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: testRecipient }),
      });
      const data = await res.json();
      setMessage(data.message);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-[#E4E6EB] text-xs text-[#65676B]">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-[#1877F2]" />
        Memuat konfigurasi SMTP...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E4E6EB] p-6 shadow-xs space-y-6">
      <div>
        <h3 className="text-base font-bold text-[#050505]">Pengaturan Server Email SMTP</h3>
        <p className="text-xs text-[#65676B] mt-0.5">
          Digunakan untuk pengiriman otomatis notifikasi pesanan, konfirmasi pembayaran, dan serah terima buku ke orang tua murid.
        </p>
      </div>

      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1877F2]" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="block font-semibold mb-1">Host Server SMTP</label>
          <input
            type="text"
            required
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
            placeholder="smtp.gmail.com"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Port SMTP</label>
          <input
            type="number"
            required
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 587)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Username / Email Akun</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
            placeholder="admin@alwildan.sch.id"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Password SMTP / App Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
            placeholder="Kosongkan jika tidak ingin mengubah"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Nama Pengirim (From Name)</label>
          <input
            type="text"
            required
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Email Pengirim (From Email)</label>
          <input
            type="email"
            required
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            className="w-full px-3 py-2 border border-[#CED0D4] rounded-xl"
          />
        </div>

        <div className="sm:col-span-2 flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="secure"
            checked={secure}
            onChange={(e) => setSecure(e.target.checked)}
            className="w-4 h-4 rounded text-[#1877F2]"
          />
          <label htmlFor="secure" className="font-semibold text-[#050505] cursor-pointer">
            Gunakan Enkripsi TLS/SSL Aman (Biasanya untuk port 465)
          </label>
        </div>

        <div className="sm:col-span-2 pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-[#1877F2] text-white rounded-xl font-semibold shadow-xs hover:bg-[#166FE5]"
          >
            {isSaving ? "Menyimpan..." : "Simpan Konfigurasi SMTP"}
          </button>
        </div>
      </form>

      {/* Test Email Section */}
      <div className="border-t border-[#E4E6EB] pt-5">
        <h4 className="text-xs font-bold text-[#050505] uppercase tracking-wider mb-2">
          Uji Coba Pengiriman Email
        </h4>
        <div className="flex gap-2 max-w-md">
          <input
            type="email"
            placeholder="Masukkan email penerima tes..."
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            className="flex-1 px-3 py-2 border border-[#CED0D4] rounded-xl text-xs"
          />
          <button
            type="button"
            disabled={isTesting}
            onClick={handleSendTest}
            className="px-4 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] font-semibold text-xs text-[#050505] rounded-xl"
          >
            {isTesting ? "Mengirim..." : "Kirim Email Tes"}
          </button>
        </div>
      </div>
    </div>
  );
}
