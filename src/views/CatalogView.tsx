import { useState, useEffect } from "react";
import { School, Book } from "../types";
import { Plus, Image as ImageIcon, BookOpen, Search, Upload } from "lucide-react";

export function CatalogView({ activeSchool }: { activeSchool: School | null }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    isbn: "",
    title: "",
    author: "",
    publisher: "",
    publishYear: 2024,
    category: "General",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [generatingForBook, setGeneratingForBook] = useState<Book | null>(null);
  const [generateCount, setGenerateCount] = useState(5);
  const [isSubmittingBook, setIsSubmittingBook] = useState(false);

  const fetchBooks = () => {
    fetch("/api/books")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setBooks(data.data);
      });
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleCoverChange = (file: File | null) => {
    setCoverFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setCoverPreviewUrl(url);
    } else {
      setCoverPreviewUrl(null);
    }
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingBook(true);
    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        const newBookId = data.data.id;
        if (coverFile) {
          const coverFormData = new FormData();
          coverFormData.append("cover", coverFile);
          await fetch(`/api/books/${newBookId}/cover`, {
            method: "POST",
            body: coverFormData,
          });
        }
        setIsAdding(false);
        setFormData({ isbn: "", title: "", author: "", publisher: "", publishYear: 2024, category: "General" });
        setCoverFile(null);
        setCoverPreviewUrl(null);
        fetchBooks();
      } else {
        const errorMsg = data.message || (data.error && typeof data.error === "string" ? data.error : JSON.stringify(data.error)) || "Failed to create book";
        alert(errorMsg);
      }
    } catch (err: any) {
      alert(`Gagal mendaftarkan buku: ${err?.message || "Terjadi kesalahan koneksi"}`);
    } finally {
      setIsSubmittingBook(false);
    }
  };

  const handleUploadCover = async (bookId: string, file: File) => {
    try {
      const data = new FormData();
      data.append("cover", file);
      const res = await fetch(`/api/books/${bookId}/cover`, {
        method: "POST",
        body: data,
      });
      const resData = await res.json();
      if (!resData.success) {
        alert(resData.message || "Gagal mengunggah cover buku");
      }
      fetchBooks();
    } catch {
      alert("Gagal mengunggah cover buku");
    }
  };

  const handleBatchGenerate = async () => {
    if (!generatingForBook || !activeSchool) return;
    try {
      const res = await fetch("/api/book-items/batch-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: generatingForBook.id,
          schoolId: activeSchool.id,
          count: Number(generateCount),
          barcodePrefix: generatingForBook.title.slice(0, 3).toUpperCase(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Berhasil membuat ${data.count} eksemplar fisik untuk ${activeSchool.name}!`);
        setGeneratingForBook(null);
      } else {
        const errMsg = data.message || (data.error && typeof data.error === "string" ? data.error : "Gagal generate eksemplar fisik");
        alert(`Gagal: ${errMsg}`);
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan sistem: ${err?.message || "Koneksi terputus"}`);
    }
  };

  const filteredBooks = books.filter((book) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      book.title.toLowerCase().includes(q) ||
      book.isbn.toLowerCase().includes(q) ||
      book.author.toLowerCase().includes(q) ||
      (book.publisher && book.publisher.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-[#E4E6EB] shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-[#050505]">
            Central Book Catalog
          </h2>
          <p className="text-xs text-[#65676B] mt-0.5">
            Master data buku global dan registrasi eksemplar fisik ({books.length} judul terdaftar).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#65676B]" />
            <input
              type="text"
              placeholder="Cari judul, ISBN, penulis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 text-xs font-medium border border-[#CED0D4] rounded-full bg-[#F0F2F5] hover:bg-[#E4E6EB] focus:bg-white w-full sm:w-72 focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2] transition-all placeholder-[#8A8D91]"
            />
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Buku
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleCreateBook} className="p-5 sm:p-6 border border-[#CED0D4] bg-white rounded-2xl space-y-4 max-w-2xl shadow-xl">
          <div className="font-bold text-base text-[#050505] border-b border-[#E4E6EB] pb-3">
            Daftarkan Judul Katalog Baru
          </div>
          
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Cover Upload Dropzone / Preview */}
            <div className="sm:w-36 flex flex-col items-center justify-start shrink-0">
              <label className="block text-xs font-semibold text-[#050505] mb-1.5 self-start">Cover Buku</label>
              <label
                className={`w-full aspect-[3/4] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden group ${
                  coverPreviewUrl
                    ? "border-[#1877F2] bg-[#E7F3FF]/20"
                    : "border-[#CED0D4] bg-[#F0F2F5] hover:border-[#1877F2] hover:bg-[#E7F3FF]/10"
                }`}
              >
                {coverPreviewUrl ? (
                  <>
                    <img
                      src={coverPreviewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold">
                      Ubah Cover
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center p-3 text-center">
                    <Upload className="w-6 h-6 text-[#1877F2] mb-1.5" />
                    <span className="text-xs font-semibold text-[#050505]">Upload Cover</span>
                    <span className="text-[10px] text-[#65676B] mt-0.5">PNG, JPG to R2</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleCoverChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            {/* Form Fields */}
            <div className="flex-1 grid grid-cols-2 gap-3.5 text-xs">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[#050505] mb-1">Nomor ISBN</label>
                <input
                  required
                  className="w-full font-mono border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  placeholder="978-3-16-148410-0"
                  value={formData.isbn}
                  onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[#050505] mb-1">Judul Buku</label>
                <input
                  required
                  className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  placeholder="Judul lengkap buku"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-[#050505] mb-1">Penulis / Author</label>
                <input
                  required
                  className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  placeholder="Nama penulis"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-[#050505] mb-1">Penerbit / Publisher</label>
                <input
                  required
                  className="w-full border border-[#CED0D4] p-2.5 rounded-lg text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
                  placeholder="Penerbit"
                  value={formData.publisher}
                  onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-[#E4E6EB]">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setCoverFile(null);
                setCoverPreviewUrl(null);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmittingBook}
              className="px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmittingBook ? "Menyimpan..." : "Simpan Buku"}
            </button>
          </div>
        </form>
      )}

      {/* Mobile Card List (< md) */}
      <div className="md:hidden space-y-3">
        {filteredBooks.length === 0 ? (
          <div className="border border-[#E4E6EB] bg-white rounded-xl p-8 text-center text-xs text-[#65676B] shadow-xs">
            {books.length === 0
              ? 'Belum ada judul katalog. Klik "Tambah Buku" untuk membuat baru.'
              : 'Tidak ada buku yang sesuai dengan pencarian.'}
          </div>
        ) : (
          filteredBooks.map((book) => (
            <div key={book.id} className="border border-[#E4E6EB] bg-white rounded-xl p-4 flex gap-3.5 items-start shadow-xs hover:border-[#CED0D4] transition-colors">
              {/* Cover thumbnail */}
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
                        if (e.target.files?.[0]) handleUploadCover(book.id, e.target.files[0]);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Book Details */}
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
                {book.publisher && (
                  <div className="text-[11px] text-[#65676B]">
                    Pub: {book.publisher}
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t border-[#E4E6EB] flex justify-end">
                  <button
                    onClick={() => setGeneratingForBook(book)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#E7F3FF] text-[#1877F2] hover:bg-[#1877F2] hover:text-white rounded-lg transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Cetak Fisik Eksemplar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Catalog Table (>= md) */}
      <div className="hidden md:block border border-[#E4E6EB] bg-white rounded-xl shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E4E6EB] bg-[#F0F2F5] text-[#65676B] text-[11px] font-bold uppercase tracking-wider">
              <th className="py-3 px-4">Cover</th>
              <th className="py-3 px-4">Judul & Penulis</th>
              <th className="py-3 px-4">ISBN</th>
              <th className="py-3 px-4">Penerbit</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6EB]">
            {filteredBooks.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[#65676B]">
                  {books.length === 0
                    ? 'Belum ada judul katalog. Klik "Tambah Buku" untuk membuat baru.'
                    : 'Tidak ada buku yang sesuai dengan pencarian.'}
                </td>
              </tr>
            ) : (
              filteredBooks.map((book) => (
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
                            if (e.target.files?.[0]) handleUploadCover(book.id, e.target.files[0]);
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
                    <button
                      onClick={() => setGeneratingForBook(book)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#E7F3FF] text-[#1877F2] hover:bg-[#1877F2] hover:text-white rounded-lg transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Cetak Fisik Eksemplar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Physical Copies Generator Modal */}
      {generatingForBook && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#CED0D4] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="font-bold text-lg text-[#050505]">Generate Physical Copies</div>
            <div className="text-xs text-[#65676B]">
              Cetak dan register barcode eksemplar buku <span className="font-bold text-[#1877F2]">{generatingForBook.title}</span> untuk cabang{" "}
              <span className="font-bold text-[#050505]">{activeSchool?.name}</span>.
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#050505] mb-1">Jumlah Eksemplar</label>
              <input
                type="number"
                min="1"
                max="100"
                value={generateCount}
                onChange={(e) => setGenerateCount(Number(e.target.value))}
                className="w-full border border-[#CED0D4] p-2.5 rounded-lg font-mono text-xs focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]"
              />
            </div>

            <div className="flex gap-2.5 justify-end pt-3 border-t border-[#E4E6EB]">
              <button
                onClick={() => setGeneratingForBook(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleBatchGenerate}
                className="px-4 py-2 text-xs font-bold bg-[#1877F2] text-white rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm"
              >
                Generate & Barcode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
