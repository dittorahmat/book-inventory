import { useState } from "react";
import { UserCheck, UserX, Loader2 } from "lucide-react";
import type { StudentRecord } from "./students-api";

interface VerificationQueueProps {
  pending: StudentRecord[];
  verifyingId: string | null;
  onVerify: (id: string, action: "approve" | "reject", nis?: string) => void;
}

export function VerificationQueue({ pending, verifyingId, onVerify }: VerificationQueueProps) {
  const [nisInputs, setNisInputs] = useState<Record<string, string>>({});

  if (pending.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden">
      <div className="px-4 sm:px-5 py-3 bg-amber-50/60 border-b border-amber-200">
        <span className="text-xs font-bold text-amber-800">
          Antrian Verifikasi ({pending.length} menunggu persetujuan)
        </span>
      </div>
      <div className="divide-y divide-[#E4E6EB]">
        {pending.map((st) => (
          <div key={st.id} className="px-4 sm:px-5 py-3.5 space-y-2.5">
            <div>
              <div className="text-xs font-bold text-[#050505]">{st.name}</div>
              <div className="text-[11px] text-[#65676B] mt-0.5">
                Kelas {st.gradeLevel} &bull; {st.schoolName} &bull; Ortu: {st.parentName || "-"}
                {st.parentPhone ? ` (${st.parentPhone})` : ""}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={nisInputs[st.id] || ""}
                onChange={(e) => setNisInputs((prev) => ({ ...prev, [st.id]: e.target.value }))}
                placeholder="Isi NIS resmi untuk menyetujui..."
                className="flex-1 px-3 py-2 bg-white border border-[#CED0D4] rounded-xl text-xs text-[#050505]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={verifyingId === st.id || !(nisInputs[st.id] || "").trim()}
                  onClick={() => onVerify(st.id, "approve", (nisInputs[st.id] || "").trim())}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {verifyingId === st.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Setujui</span>
                </button>
                <button
                  type="button"
                  disabled={verifyingId === st.id}
                  onClick={() => {
                    if (window.confirm(`Tolak pendaftaran ${st.name}?`)) {
                      onVerify(st.id, "reject");
                    }
                  }}
                  className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 active:scale-[0.98] rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Tolak</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
