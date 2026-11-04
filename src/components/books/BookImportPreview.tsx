import { formatRupiah } from "../../lib/transfer-pricing";
import type { ParsedBookRow } from "../../lib/book-import-parser";

interface BookImportPreviewProps {
  parsedBooks: ParsedBookRow[];
  sheetName: string;
}

export function BookImportPreview({ parsedBooks, sheetName }: BookImportPreviewProps) {
  if (parsedBooks.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[#050505]">
          Pratinjau Hasil Pembacaan {sheetName && `(Sheet: ${sheetName})`}
        </span>
        <span className="text-emerald-600 font-bold">{parsedBooks.length} judul siap diimpor</span>
      </div>
      <div className="border border-[#E4E6EB] rounded-xl overflow-hidden max-h-40 overflow-y-auto text-[11px]">
        <table className="w-full text-left">
          <thead className="bg-[#F0F2F5] text-[#65676B] sticky top-0">
            <tr>
              <th className="p-2">Judul</th>
              <th className="p-2">Kelas</th>
              <th className="p-2">Harga</th>
              <th className="p-2">Penerbit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {parsedBooks.slice(0, 5).map((b, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="p-2 font-medium text-[#050505]">{b.title}</td>
                <td className="p-2">Kelas {b.gradeLevel}</td>
                <td className="p-2 font-mono">{formatRupiah(b.price)}</td>
                <td className="p-2 text-[10px] text-[#65676B]">{b.publisher || "Penerbit Al-Wildan"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {parsedBooks.length > 5 && (
        <div className="text-[11px] text-[#65676B] text-center">... dan {parsedBooks.length - 5} judul buku lainnya.</div>
      )}
    </div>
  );
}
