import { BookOpen, Globe, LogOut, School as SchoolIcon, Shield } from "lucide-react";
import type { School } from "../../types";
import { getRoleBadgeLabel, type StaffRole } from "../../lib/staff-roles";

interface AppHeaderProps {
  selectedSchool: School | null;
  schools?: School[];
  onSelectSchool?: (school: School | null) => void;
  isCentralAdmin: boolean;
  canSelectBranch?: boolean;
  userRole?: StaffRole;
  userName: string;
  onOpenPublicPortal: () => void;
  onSignOut: () => void;
}

export function AppHeader({
  selectedSchool,
  schools = [],
  onSelectSchool,
  isCentralAdmin,
  canSelectBranch = false,
  userRole,
  userName,
  onOpenPublicPortal,
  onSignOut,
}: AppHeaderProps) {
  const badgeLabel = getRoleBadgeLabel(userRole);

  return (
    <div className="bg-[#1877F2]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Al Wildan Logistics Crest Icon */}
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white shadow-xs shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div className="truncate">
            <span className="text-base sm:text-lg tracking-tight font-bold text-white truncate block sm:inline">
              School Logistics
            </span>
            <span className="hidden sm:inline-block ml-2 text-[11px] font-semibold text-white bg-white/15 border border-white/30 px-2 py-0.5 rounded-full">
              Al Wildan
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Assigned location badge or Branch Selector for central/logistics */}
          {canSelectBranch && onSelectSchool ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 rounded-xl text-xs font-semibold text-white border border-white/30">
              <SchoolIcon className="w-3.5 h-3.5 text-white shrink-0" />
              <select
                aria-label="Pilih Cabang"
                className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer [&>option]:text-black"
                value={selectedSchool?.id ?? "all"}
                onChange={(e) => {
                  const val = e.target.value;
                  onSelectSchool(val === "all" ? null : schools.find((s) => s.id === val) ?? null);
                }}
              >
                <option value="all">Semua Cabang (Global)</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 rounded-full text-xs font-semibold text-white border border-white/30">
              <SchoolIcon className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="truncate max-w-[110px] sm:max-w-none">
                {selectedSchool?.name || "Assigned Branch"}
              </span>
            </div>
          )}

          {/* User Badge & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-white/25">
            <button
              type="button"
              onClick={onOpenPublicPortal}
              title="Lihat Portal Orang Tua"
              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 border border-emerald-200 active:scale-[0.98]"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Portal Ortu</span>
            </button>

            <div className="text-right hidden md:block">
              <div className="text-xs font-semibold text-white">{userName}</div>
              <div className="text-[11px] text-white/75 flex items-center justify-end gap-1">
                {isCentralAdmin ? (
                  <span className="text-white flex items-center gap-1 font-semibold">
                    <Shield className="w-3 h-3 text-white" /> {badgeLabel}
                  </span>
                ) : (
                  <span>{badgeLabel}</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              title="Sign Out"
              className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors bg-white/15 active:scale-[0.98]"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
