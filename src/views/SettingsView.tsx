import { useState, useEffect } from "react";
import { School, User } from "../types";
import { Building2, Users, Plus } from "lucide-react";

interface SettingsViewProps {
  currentUser?: any;
  onSchoolsUpdated?: () => void;
}

export function SettingsView({ onSchoolsUpdated }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"schools" | "users">("schools");
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
    <div className="space-y-6">
      {/* Header & Subtabs */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-[#E5E5E0]">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#1A1A1A]">
            Organization & System Settings
          </h2>
          <p className="text-xs text-[#737373] font-mono mt-0.5">
            Manage school branches, headquarters, and administrative staff
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#F0F0EC] p-1 rounded-md text-xs font-mono">
          <button
            onClick={() => setActiveTab("schools")}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
              activeTab === "schools"
                ? "bg-white text-[#1A1A1A] font-semibold shadow-sm"
                : "text-[#737373] hover:text-[#1A1A1A]"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            School Hierarchy ({schoolsList.length})
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
              activeTab === "users"
                ? "bg-white text-[#1A1A1A] font-semibold shadow-sm"
                : "text-[#737373] hover:text-[#1A1A1A]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Staff Accounts ({usersList.length})
          </button>
        </div>
      </div>

      {/* 1. School Hierarchy Tab */}
      {activeTab === "schools" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-[#737373]">
              Registered Schools & Branches
            </span>
            <button
              onClick={() => setIsAddingSchool(!isAddingSchool)}
              className="px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#333] text-white rounded text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAddingSchool ? "Cancel" : "Add School Branch"}
            </button>
          </div>

          {/* New School Modal/Inline Form */}
          {isAddingSchool && (
            <div className="bg-white border border-[#1A1A1A] rounded-lg p-5 shadow-sm space-y-4">
              <div className="text-xs font-mono font-semibold uppercase tracking-wider text-[#1A1A1A]">
                Register New School
              </div>
              <form onSubmit={handleCreateSchool} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-[#525252] mb-1">School Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Al Wildan 5 (Islamic School)"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#D4D4D0] rounded text-sm font-mono focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#525252] mb-1">Branch Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ALW-05"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 border border-[#D4D4D0] rounded text-sm font-mono focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#525252] mb-1">Type *</label>
                  <select
                    value={schoolType}
                    onChange={(e) => setSchoolType(e.target.value as "main" | "branch")}
                    className="w-full px-3 py-1.5 border border-[#D4D4D0] rounded text-sm font-mono focus:outline-none focus:border-[#1A1A1A]"
                  >
                    <option value="branch">Branch (Cabang)</option>
                    <option value="main">Headquarters (Pusat / Central)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#525252] mb-1">Phone Contact</label>
                  <input
                    type="text"
                    placeholder="e.g. +62 21 5550105"
                    value={schoolPhone}
                    onChange={(e) => setSchoolPhone(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#D4D4D0] rounded text-sm font-mono focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-mono text-[#525252] mb-1">Full Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Jl. Raya Sudirman No. 100"
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#D4D4D0] rounded text-sm font-mono focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingSchool(false)}
                    className="px-3 py-1.5 border border-[#D4D4D0] text-[#525252] rounded text-xs font-mono hover:bg-[#F0F0EC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#1A1A1A] text-white rounded text-xs font-mono hover:bg-[#333]"
                  >
                    Save School
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Schools Table */}
          <div className="bg-white border border-[#E5E5E0] rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#F8F8F6] border-b border-[#E5E5E0] text-[#737373]">
                <tr>
                  <th className="py-3 px-4">CODE</th>
                  <th className="py-3 px-4">NAME</th>
                  <th className="py-3 px-4">TYPE</th>
                  <th className="py-3 px-4">ADDRESS</th>
                  <th className="py-3 px-4">PHONE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0EC]">
                {schoolsList.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FAFAFA]">
                    <td className="py-3 px-4 font-semibold text-[#1A1A1A]">{s.code}</td>
                    <td className="py-3 px-4 font-medium text-[#1A1A1A] flex items-center gap-2">
                      {s.name}
                      {s.type === "main" && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          HQ
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 uppercase text-[#525252]">{s.type}</td>
                    <td className="py-3 px-4 text-[#737373]">{s.address || "-"}</td>
                    <td className="py-3 px-4 text-[#737373]">{s.phone || "-"}</td>
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
            <span className="text-xs font-mono text-[#737373]">
              Authorized Administrative Staff
            </span>
            <button
              onClick={() => setIsAddingUser(!isAddingUser)}
              className="px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#333] text-white rounded text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAddingUser ? "Cancel" : "Add Admin Account"}
            </button>
          </div>

          {/* New User Form */}
          {isAddingUser && (
            <div className="bg-white border border-[#1A1A1A] rounded-lg p-5 shadow-sm space-y-4">
              <div className="text-xs font-mono font-semibold uppercase tracking-wider text-[#1A1A1A]">
                Create Staff Account
              </div>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-[#525252] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ustadz Ahmad Fauzi"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#D4D4D0] rounded text-sm font-mono focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#525252] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. fauzi@alwildan.sch.id"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#D4D4D0] rounded text-sm font-mono focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#525252] mb-1">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#D4D4D0] rounded text-sm font-mono focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#525252] mb-1">Role *</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as "central_admin" | "branch_admin")}
                    className="w-full px-3 py-1.5 border border-[#D4D4D0] rounded text-sm font-mono focus:outline-none focus:border-[#1A1A1A]"
                  >
                    <option value="branch_admin">Branch Admin (Admin Cabang)</option>
                    <option value="central_admin">Central Admin (Admin Pusat)</option>
                  </select>
                </div>
                {userRole === "branch_admin" && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-[#525252] mb-1">
                      Assigned Branch School *
                    </label>
                    <select
                      required
                      value={userSchoolId}
                      onChange={(e) => setUserSchoolId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#D4D4D0] rounded text-sm font-mono focus:outline-none focus:border-[#1A1A1A]"
                    >
                      <option value="">-- Select Assigned Branch --</option>
                      {schoolsList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code}) - {s.type.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingUser(false)}
                    className="px-3 py-1.5 border border-[#D4D4D0] text-[#525252] rounded text-xs font-mono hover:bg-[#F0F0EC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#1A1A1A] text-white rounded text-xs font-mono hover:bg-[#333]"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users Table */}
          <div className="bg-white border border-[#E5E5E0] rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#F8F8F6] border-b border-[#E5E5E0] text-[#737373]">
                <tr>
                  <th className="py-3 px-4">NAME</th>
                  <th className="py-3 px-4">EMAIL</th>
                  <th className="py-3 px-4">ROLE</th>
                  <th className="py-3 px-4">ASSIGNED SCHOOL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0EC]">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-[#FAFAFA]">
                    <td className="py-3 px-4 font-semibold text-[#1A1A1A]">{u.name}</td>
                    <td className="py-3 px-4 text-[#525252]">{u.email}</td>
                    <td className="py-3 px-4">
                      {u.role === "central_admin" ? (
                        <span className="bg-neutral-900 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                          CENTRAL ADMIN
                        </span>
                      ) : (
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-medium">
                          BRANCH ADMIN
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#737373]">
                      {u.school ? `${u.school.name} (${u.school.code})` : "All Branches (Global Access)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
