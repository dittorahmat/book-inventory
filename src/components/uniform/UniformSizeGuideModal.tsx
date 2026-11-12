import { getUniformSizeChart } from "../../lib/uniform-size-chart";
import type { UniformJenjang } from "../../lib/uniform-types";

interface UniformSizeGuideModalProps {
  jenjang: UniformJenjang;
  isOpen: boolean;
  onClose: () => void;
}

export function UniformSizeGuideModal({ jenjang, isOpen, onClose }: UniformSizeGuideModalProps) {
  if (!isOpen) return null;

  const chart = getUniformSizeChart(jenjang);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-[#E4E6EB] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#050505]">Panduan Ukuran Seragam Olahraga</h3>
            <p className="text-xs text-[#65676B]">Standar ukuran resmi jenjang {jenjang.toUpperCase()}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#65676B] hover:bg-[#F0F2F5] text-lg font-bold"
          >
            ×
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#E4E6EB]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F0F2F5] text-[#050505] font-bold border-b border-[#E4E6EB]">
              <tr>
                <th className="px-3 py-2 text-center">No</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2 text-right">Lebar Dada</th>
                <th className="px-3 py-2 text-right">Pj. Celana/Rok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6EB]">
              {chart.map((row) => (
                <tr key={row.size} className="hover:bg-[#F7F8FA]">
                  <td className="px-3 py-2 text-center text-[#65676B]">{row.chartNumber}</td>
                  <td className="px-3 py-2 font-bold text-[#1877F2]">{row.size}</td>
                  <td className="px-3 py-2 text-right">{row.chestWidthCm} cm</td>
                  <td className="px-3 py-2 text-right">{row.bottomLengthCm} cm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-[#F0F2F5] rounded-xl p-3 text-[11px] text-[#65676B] space-y-1">
          <p className="font-semibold text-[#050505]">Tips Pengukuran:</p>
          <p>• <strong>Lebar Dada (LD):</strong> Ukur mendatar dari bawah ketiak kiri ke ketiak kanan.</p>
          <p>• <strong>Panjang Celana/Rok (P):</strong> Ukur dari pinggang sampai ke ujung bawah mata kaki.</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-[#1877F2] text-white text-xs font-semibold rounded-xl hover:bg-[#1664D9] active:scale-[0.98]"
        >
          Tutup Panduan
        </button>
      </div>
    </div>
  );
}
