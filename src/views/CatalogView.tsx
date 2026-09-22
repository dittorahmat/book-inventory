import { useState, useEffect } from "react";
import { School, Book } from "../types";
import { Plus, Image as ImageIcon, BookOpen, Search } from "lucide-react";

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
        alert(data.message || "Failed to create book");
      }
    } catch {
      alert("Failed to create book record");
    } finally {
      setIsSubmittingBook(false);
    }
  };

  const handleUploadCover = async (bookId: string, file: File) => {
    const data = new FormData();
    data.append("cover", file);
    await fetch(`/api/books/${bookId}/cover`, {
      method: "POST",
      body: data,
    });
    fetchBooks();
  };

  const handleBatchGenerate = async () => {
    if (!generatingForBook || !activeSchool) return;
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
      alert(`Successfully generated ${data.count} physical copies for ${activeSchool.name}!`);
      setGeneratingForBook(null);
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E5E0] pb-4">
        <div>
          <h2 className="text-xl font-editorial font-semibold text-[#1A1A1A]">
            Central Book Catalog
          </h2>
          <p className="text-xs text-[#737373]">
            Global book master records and physical copy printing ({books.length} titles).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#737373]" />
            <input
              type="text"
              placeholder="Search title, ISBN, author, publisher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-mono border border-[#E5E5E0] rounded bg-white w-72 focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-[#1A1A1A] text-white rounded hover:bg-[#333333] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Title
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleCreateBook} className="p-4 border border-[#E5E5E0] bg-white rounded space-y-4 max-w-2xl shadow-sm">
          <div className="font-editorial font-medium text-sm text-[#1A1A1A]">Register New Catalog Title</div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Cover Upload Dropzone / Preview */}
            <div className="sm:w-36 flex flex-col items-center justify-start shrink-0">
              <label className="block text-[11px] font-mono text-[#737373] mb-1.5 self-start">Book Cover</label>
              <label
                className={`w-28 h-36 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden ${
                  coverPreviewUrl
                    ? "border-[#1A1A1A] bg-black/5"
                    : "border-[#D4D4CE] hover:border-[#1A1A1A] bg-[#FAFAF8]"
                }`}
              >
                {coverPreviewUrl ? (
                  <>
                    <img
                      src={coverPreviewUrl}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-[10px] font-mono transition-opacity">
                      Change Cover
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center p-2 text-[#737373]">
                    <ImageIcon className="w-5 h-5 mb-1 text-[#888888]" />
                    <span className="text-[10px] font-mono leading-tight">Upload Cover</span>
                    <span className="text-[9px] text-[#A0A09C] mt-0.5">PNG, JPG, WebP</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleCoverChange(e.target.files?.[0] || null)}
                />
              </label>
              {coverFile && (
                <button
                  type="button"
                  onClick={() => handleCoverChange(null)}
                  className="text-[10px] text-red-600 hover:underline mt-1 font-mono"
                >
                  Hapus Cover
                </button>
              )}
            </div>

            {/* Form Fields */}
            <div className="flex-1 grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[#737373] mb-1">ISBN</label>
                <input
                  required
                  className="w-full border border-[#E5E5E0] p-1.5 rounded font-mono text-xs focus:outline-none focus:border-[#1A1A1A]"
                  placeholder="978-..."
                  value={formData.isbn}
                  onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[#737373] mb-1">Title</label>
                <input
                  required
                  className="w-full border border-[#E5E5E0] p-1.5 rounded text-xs focus:outline-none focus:border-[#1A1A1A]"
                  placeholder="Book title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[#737373] mb-1">Author</label>
                <input
                  required
                  className="w-full border border-[#E5E5E0] p-1.5 rounded text-xs focus:outline-none focus:border-[#1A1A1A]"
                  placeholder="Author name"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[#737373] mb-1">Publisher</label>
                <input
                  required
                  className="w-full border border-[#E5E5E0] p-1.5 rounded text-xs focus:outline-none focus:border-[#1A1A1A]"
                  placeholder="Publisher"
                  value={formData.publisher}
                  onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-[#F0F0EC]">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setCoverFile(null);
                setCoverPreviewUrl(null);
              }}
              className="px-3 py-1 text-xs border border-[#E5E5E0] rounded text-[#737373] hover:bg-[#FAFAF8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingBook}
              className="px-3 py-1 text-xs bg-[#1A1A1A] text-white rounded font-mono hover:bg-[#333333] disabled:opacity-50"
            >
              {isSubmittingBook ? "Saving..." : "Save Book"}
            </button>
          </div>
        </form>
      )}

      {/* Catalog Table */}
      <div className="border border-[#E5E5E0] bg-white rounded overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E0] bg-[#FAFAF8] text-[#737373] font-mono text-[11px]">
              <th className="py-2.5 px-4 font-normal">Cover</th>
              <th className="py-2.5 px-4 font-normal">Title & Author</th>
              <th className="py-2.5 px-4 font-normal">ISBN</th>
              <th className="py-2.5 px-4 font-normal">Publisher</th>
              <th className="py-2.5 px-4 font-normal text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0EC]">
            {filteredBooks.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#737373]">
                  {books.length === 0
                    ? 'No catalog items found. Click "Add Title" to create one.'
                    : 'No catalog items match your search.'}
                </td>
              </tr>
            ) : (
              filteredBooks.map((book) => (
                <tr key={book.id} className="hover:bg-[#FAFAF8] transition-colors">
                  <td className="py-3 px-4">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} className="w-9 h-12 object-cover rounded border border-[#E5E5E0]" />
                    ) : (
                      <label className="w-9 h-12 flex flex-col items-center justify-center border border-dashed border-[#D4D4CE] rounded cursor-pointer hover:border-[#1A1A1A] text-[#737373]">
                        <ImageIcon className="w-3.5 h-3.5" />
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
                    <div className="font-medium text-[#1A1A1A]">{book.title}</div>
                    <div className="text-[11px] text-[#737373]">{book.author}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[#555555]">{book.isbn}</td>
                  <td className="py-3 px-4 text-[#737373]">{book.publisher}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setGeneratingForBook(book)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono border border-[#E5E5E0] rounded hover:border-[#1A1A1A] text-[#1A1A1A]"
                    >
                      <BookOpen className="w-3 h-3" />
                      Add Physical Copies
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
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E5E5E0] rounded p-5 max-w-sm w-full space-y-4 shadow-sm">
            <div className="font-editorial font-semibold text-base">Generate Physical Copies</div>
            <div className="text-xs text-[#737373]">
              Assign copies of <span className="font-medium text-[#1A1A1A]">{generatingForBook.title}</span> to{" "}
              <span className="font-medium text-[#1A1A1A]">{activeSchool?.name}</span>.
            </div>

            <div>
              <label className="block text-xs font-mono text-[#737373] mb-1">Number of copies</label>
              <input
                type="number"
                min="1"
                max="100"
                value={generateCount}
                onChange={(e) => setGenerateCount(Number(e.target.value))}
                className="w-full border border-[#E5E5E0] p-1.5 rounded font-mono text-xs"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setGeneratingForBook(null)}
                className="px-3 py-1.5 text-xs border border-[#E5E5E0] rounded text-[#737373]"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchGenerate}
                className="px-3 py-1.5 text-xs bg-[#1A1A1A] text-white rounded font-mono"
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
