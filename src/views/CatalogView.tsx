import { useState } from "react";
import { useCatalogData } from "../components/catalog/useCatalogData";
import { CatalogToolbar } from "../components/catalog/CatalogToolbar";
import { CreateBookForm } from "../components/catalog/CreateBookForm";
import { CatalogBookList } from "../components/catalog/CatalogBookList";
import type { NewBookPayload } from "../components/catalog/catalog-intent";
import type { Book } from "../types";

/** Orkestrasi katalog: hook data + toolbar + form + daftar; tanpa logika orphan/harga. */
export function CatalogView() {
  const { books, isLoading, loadError, loadCatalog, createBook, uploadCover, removeBook } = useCatalogData();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleCreate = async (payload: NewBookPayload, coverFile: File | null) => {
    await createBook(payload, coverFile);
    setIsAdding(false);
  };

  const handleUploadCover = async (bookId: string, file: File) => {
    try {
      await uploadCover(bookId, file);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengunggah cover buku");
    }
  };

  const handleRemove = async (book: Book) => {
    if (!window.confirm(`Hapus buku "${book.title}"? Data judul buku akan dihapus dari katalog.`)) return;
    try {
      await removeBook(book.id);
      alert(`Buku "${book.title}" berhasil dihapus.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus buku.");
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
      <CatalogToolbar
        totalCount={books.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAdd={() => setIsAdding(true)}
      />

      {loadError && (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
          <span className="font-medium">{loadError}</span>
          <button
            type="button"
            onClick={loadCatalog}
            className="shrink-0 px-3 py-1.5 font-bold bg-white border border-red-200 rounded-lg hover:bg-red-100 transition-colors active:scale-[0.98]"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {isLoading && books.length === 0 && !loadError && (
        <div className="border border-[#E4E6EB] bg-white rounded-xl p-8 text-center text-xs text-[#65676B] shadow-xs">
          Memuat katalog buku...
        </div>
      )}

      {isAdding && <CreateBookForm onClose={() => setIsAdding(false)} onCreate={handleCreate} />}

      <CatalogBookList
        books={filteredBooks}
        isEmptyCatalog={books.length === 0}
        onUploadCover={handleUploadCover}
        onRemove={handleRemove}
      />
    </div>
  );
}
