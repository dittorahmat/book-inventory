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
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#CED0D4] bg-[#F0F2F5] hover:bg-[#E4E6EB] text-xs font-semibold text-[#050505] transition-colors shadow-xs"
      >
        <SchoolIcon className="w-3.5 h-3.5 text-[#1877F2]" />
        <span>{selectedSchool ? `${selectedSchool.name} (${selectedSchool.code})` : "Select Branch"}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[#65676B]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#CED0D4] bg-white shadow-lg z-50 py-1.5 overflow-hidden">
          <div className="px-3.5 py-1.5 text-[11px] font-semibold text-[#65676B] tracking-normal border-b border-[#E4E6EB]">
            Active School Branch
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
                className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors ${
                  isSelected ? "bg-[#E7F3FF] text-[#1877F2]" : "hover:bg-[#F0F2F5] text-[#050505]"
                }`}
              >
                <div>
                  <div className="font-semibold flex items-center gap-1.5">
                    {school.name}
                    {school.type === "main" && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-[#1877F2] text-white rounded-full">
                        HQ
                      </span>
                    )}
                  </div>
                  <div className={`text-[11px] ${isSelected ? "text-[#1877F2]/80" : "text-[#65676B]"}`}>{school.code}</div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[#1877F2]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
