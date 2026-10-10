import { Image as ImageIcon, Trash2 } from "lucide-react";
import { formatRupiah } from "../../lib/transfer-pricing";
import { effectiveBookPrice } from "../../lib/book-pricing";
import type { Book } from "../../types";

interface CatalogBookListProps {
  books: Book[];
  isEmptyCatalog: boolean;
  onUploadCover: (bookId: string, file: File) => void;
  onRemove: (book: Book) => void;
}

const emptyMessage = (isEmptyCatalog: boolean) =>
  isEmptyCatalog
    ? 'Belum ada judul katalog. Klik "Tambah Buku" untuk membuat baru.'
    : "Tidak ada buku yang sesuai dengan pencarian.";

/** Daftar katalog ganda: kartu mobile + tabel desktop. */
export function CatalogBookList({ books, isEmptyCatalog, onUploadCover, onRemove }: CatalogBookListProps) {
  return (
    <>
      <div className="md:hidden space-y-3">
        {books.length === 0 ? (
          <div className="border border-[#E4E6EB] bg-white rounded-xl p-8 text-center text-xs text-[#65676B] shadow-xs">
            {emptyMessage(isEmptyCatalog)}
          </div>
        ) : (
          books.map((book) => (
            <div key={book.id} className="border border-[#E4E6EB] bg-white rounded-xl p-4 flex gap-3.5 items-start shadow-xs hover:border-[#CED0D4] transition-colors">
              <div className="shrink-0">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-14 h-20 object-cover rounded-lg border border-[#E4E6EB] shadow-xs" />
                ) : (
                  <label className="w-14 h-20 flex flex-col items-center justify-center border-2 border-dashed border-[#CED0D4] rounded-lg cursor-pointer hover:border-[#1877F2] text-[#65676B] bg-[#F0F2F5]">
                    <ImageIcon className="w-5 h-5 text-[#1877F2]" />
                    <span className="text-[9px] font-semibold mt-1">Cover</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) onUploadCover(book.id, e.target.files[0]);
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-[#050505] leading-snug line-clamp-2">
                  {book.title}
                </div>
                <div className="text-xs text-[#65676B] mt-0.5">
                  {book.author}
                </div>
                <div className="text-[11px] font-mono text-[#65676B] mt-1">
                  ISBN: {book.isbn}
                </div>
                <div className="text-xs font-bold text-[#1877F2] mt-1">
                  Beli: {formatRupiah(effectiveBookPrice(book).buy)} &bull; Jual: {formatRupiah(effectiveBookPrice(book).sell)}
                </div>
                {book.publisher && (
                  <div className="text-[11px] text-[#65676B]">
                    Pub: {book.publisher}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block border border-[#E4E6EB] bg-white rounded-xl shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E4E6EB] bg-[#F0F2F5] text-[#65676B] text-[11px] font-bold uppercase tracking-wider">
              <th className="py-3 px-4">Cover</th>
              <th className="py-3 px-4">Judul & Penulis</th>
              <th className="py-3 px-4">ISBN</th>
              <th className="py-3 px-4">Penerbit</th>
              <th className="py-3 px-4 text-right">Harga Beli / Jual</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {books.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#65676B]">
                  {emptyMessage(isEmptyCatalog)}
                </td>
              </tr>
            ) : (
              books.map((book) => (
                <tr key={book.id} className="hover:bg-[#F0F2F5]/60 transition-colors">
                  <td className="py-3 px-4">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} className="w-10 h-14 object-cover rounded-md border border-[#E4E6EB] shadow-xs" />
                    ) : (
                      <label className="w-10 h-14 flex flex-col items-center justify-center border-2 border-dashed border-[#CED0D4] rounded-md cursor-pointer hover:border-[#1877F2] text-[#65676B] bg-[#F0F2F5]">
                        <ImageIcon className="w-4 h-4 text-[#1877F2]" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) onUploadCover(book.id, e.target.files[0]);
                          }}
                        />
                      </label>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#050505] text-sm">{book.title}</div>
                    <div className="text-xs text-[#65676B]">{book.author}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[#65676B]">{book.isbn}</td>
                  <td className="py-3 px-4 text-[#65676B] font-medium">{book.publisher}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-bold text-[#1877F2]">{formatRupiah(effectiveBookPrice(book).sell)}</div>
                    <div className="text-[10px] text-[#65676B] font-medium">Beli: {formatRupiah(effectiveBookPrice(book).buy)}</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(book)}
                      title="Hapus buku"
                      className="p-1.5 text-[#65676B] hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors active:scale-[0.98]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
