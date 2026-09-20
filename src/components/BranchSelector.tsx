import { useState, useEffect } from "react";
import { School } from "../types";
import { School as SchoolIcon, ChevronDown, Check } from "lucide-react";

interface Props {
  selectedSchool: School | null;
  onSelectSchool: (school: School) => void;
}

export function BranchSelector({ selectedSchool, onSelectSchool }: Props) {
  const [schools, setSchools] = useState<School[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          setSchools(data.data);
          if (!selectedSchool) {
            onSelectSchool(data.data[0]);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#E5E5E0] bg-white text-xs font-mono text-[#1A1A1A] hover:bg-[#F9F9F8] transition-colors"
      >
        <SchoolIcon className="w-3.5 h-3.5 text-[#737373]" />
        <span>{selectedSchool ? `${selectedSchool.name} (${selectedSchool.code})` : "Select Branch"}</span>
        <ChevronDown className="w-3 h-3 text-[#737373]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 rounded border border-[#E5E5E0] bg-white shadow-sm z-50 py-1">
          <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#737373] tracking-wider border-b border-[#F0F0EC]">
            Active School Context
          </div>
          {schools.map((school) => {
            const isSelected = selectedSchool?.id === school.id;
            return (
              <button
                key={school.id}
                onClick={() => {
                  onSelectSchool(school);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#F9F9F8] transition-colors"
              >
                <div>
                  <div className="font-medium text-[#1A1A1A] flex items-center gap-1.5">
                    {school.name}
                    {school.type === "main" && (
                      <span className="text-[9px] uppercase px-1 py-0.2 bg-[#1A1A1A] text-white rounded font-mono">
                        HQ
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-[#737373]">{school.code}</div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#1A1A1A]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
