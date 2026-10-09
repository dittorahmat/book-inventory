import { useState } from "react";
import { Building2, Users, Mail, CalendarClock, MessageSquare } from "lucide-react";
import { SatuanCutoffSettings } from "../components/settings/SatuanCutoffSettings";
import { SmtpSettingsSection } from "../components/settings/SmtpSettingsSection";
import { WhatsAppSettingsSection } from "../components/settings/WhatsAppSettingsSection";
import { SchoolsSettingsTab } from "../components/settings/SchoolsSettingsTab";
import { UsersSettingsTab } from "../components/settings/UsersSettingsTab";
import { useSettingsData } from "../components/settings/useSettingsData";
import { currentAcademicYear } from "../lib/wib-time";

interface SettingsViewProps {
  onSchoolsUpdated?: () => void;
}

export function SettingsView({ onSchoolsUpdated }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"schools" | "users" | "smtp" | "whatsapp" | "cutoff">("schools");
  const [cutoffYear, setCutoffYear] = useState(currentAcademicYear());
  const { schoolsList, usersList, loadError, createSchool, createUser } = useSettingsData();

  return (
    <div className="space-y-5">
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
          {loadError}
        </div>
      )}

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

        <div className="flex items-center gap-1.5 bg-[#F0F2F5] p-1.5 rounded-xl text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("schools")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98] ${
              activeTab === "schools"
                ? "bg-white text-[#1877F2] font-bold shadow-xs"
                : "text-[#65676B] hover:text-[#050505]"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Cabang Sekolah ({schoolsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98] ${
              activeTab === "users"
                ? "bg-white text-[#1877F2] font-bold shadow-xs"
                : "text-[#65676B] hover:text-[#050505]"
            }`}
          >
            <Users className="w-4 h-4" />
            Akun Staf ({usersList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("smtp")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98] ${
              activeTab === "smtp"
                ? "bg-white text-[#1877F2] font-bold shadow-xs"
                : "text-[#65676B] hover:text-[#050505]"
            }`}
          >
            <Mail className="w-4 h-4" />
            Email SMTP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("whatsapp")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98] ${
              activeTab === "whatsapp"
                ? "bg-white text-emerald-600 font-bold shadow-xs"
                : "text-[#65676B] hover:text-[#050505]"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cutoff")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98] ${
              activeTab === "cutoff"
                ? "bg-white text-[#1877F2] font-bold shadow-xs"
                : "text-[#65676B] hover:text-[#050505]"
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            Cut-off Satuan
          </button>
        </div>
      </div>

      {activeTab === "schools" && (
        <SchoolsSettingsTab
          schoolsList={schoolsList}
          onSchoolsUpdated={onSchoolsUpdated}
          createSchool={createSchool}
        />
      )}

      {activeTab === "users" && (
        <UsersSettingsTab
          usersList={usersList}
          schoolsList={schoolsList}
          createUser={createUser}
        />
      )}

      {activeTab === "smtp" && (
        <SmtpSettingsSection />
      )}

      {activeTab === "whatsapp" && (
        <WhatsAppSettingsSection />
      )}

      {activeTab === "cutoff" && (
        <div className="bg-white rounded-2xl border border-[#E4E6EB] shadow-xs p-5 space-y-4 max-w-2xl">
          <div>
            <label className="block text-xs font-semibold text-[#050505] mb-1">Tahun Ajaran</label>
            <input
              className="w-48 px-3 py-2 bg-white border border-[#CED0D4] rounded-lg text-xs text-[#050505] focus:outline-hidden focus:border-[#1877F2]"
              placeholder="2026/2027"
              value={cutoffYear}
              onChange={(e) => setCutoffYear(e.target.value)}
            />
          </div>
          <SatuanCutoffSettings academicYear={cutoffYear} />
        </div>
      )}
    </div>
  );
}
