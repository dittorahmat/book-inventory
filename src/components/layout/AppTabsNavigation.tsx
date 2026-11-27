import { DESKTOP_TABS, type ActiveTab } from "./staff-tabs";
import type { StaffRole } from "../../lib/staff-roles";

interface AppTabsNavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  role: StaffRole;
}

export function AppTabsNavigation({ activeTab, onSelectTab, role }: AppTabsNavigationProps) {
  const visibleTabs = DESKTOP_TABS.filter((tab) => tab.visible(role));

  return (
    <div className="bg-white border-b border-[#E4E6EB]">
      <div className="hidden md:flex max-w-7xl mx-auto px-6 gap-1 text-sm overflow-x-auto">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelectTab(tab.id)}
              className={`py-3 px-3.5 flex items-center gap-2 font-semibold transition-all relative shrink-0 active:scale-[0.98] ${
                isActive
                  ? "text-[#1877F2] border-b-[3px] border-[#1877F2]"
                  : "text-[#65676B] hover:bg-[#F0F2F5] rounded-lg my-1 py-2 border-b-[3px] border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label(role)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface AppMobileNavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  role: StaffRole;
}

export function AppMobileNavigation({ activeTab, onSelectTab, role }: AppMobileNavigationProps) {
  const visibleTabs = DESKTOP_TABS.filter((tab) => tab.visible(role));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E4E6EB] shadow-lg pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 px-2">
      <div className="grid grid-cols-4 gap-1 py-0.5">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-center transition-colors active:scale-[0.98] ${
                isActive
                  ? "text-[#1877F2] font-bold bg-[#E7F3FF]"
                  : "text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5]"
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5 shrink-0" />
              <span className="text-[10px] leading-tight font-semibold">{tab.label(role)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
