import { apiEnvelope } from "../../lib/api";
import type { ParsedBookRow } from "../../lib/book-import-parser";

export const SAMPLE_BOOK_CSV =
  "isbn,judul,kelas,harga_jual,harga_beli,penerbit\n" +
  "978-0132350884,Clean Code,1,150000,100000,Prentice Hall\n" +
  "978-0201616224,The Pragmatic Programmer,2,175000,120000,Addison-Wesley\n";

export function downloadSampleBookTemplate() {
  const blob = new Blob([SAMPLE_BOOK_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "template_import_katalog_buku.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function submitBooksInChunks(params: {
  books: ParsedBookRow[];
  autoCreatePackages: boolean;
  academicYear: string;
}): Promise<{ totalInserted: number; totalUpdated: number; totalPackages: number }> {
  const CHUNK_SIZE = 50;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalPackages = 0;

  // Deduplikasi awal berdasarkan kombinasi title + gradeLevel agar batch chunk bebas konflik
  const seen = new Set<string>();
  const uniqueBooks: ParsedBookRow[] = [];
  for (const b of params.books) {
    const key = `${b.title.trim().toLowerCase()}__${b.gradeLevel ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBooks.push(b);
    }
  }

  for (let i = 0; i < uniqueBooks.length; i += CHUNK_SIZE) {
    const batch = uniqueBooks.slice(i, i + CHUNK_SIZE);
    const res = await apiEnvelope<{
      success: boolean;
      message: string;
      data: { insertedCount: number; updatedCount: number; packagesCreatedCount?: number };
    }>("/api/books/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        books: batch,
        autoCreatePackages: params.autoCreatePackages,
        academicYear: params.academicYear,
      }),
    });

    if (res.data) {
      totalInserted += res.data.insertedCount;
      totalUpdated += res.data.updatedCount;
      totalPackages += res.data.packagesCreatedCount || 0;
    }
  }

  return { totalInserted, totalUpdated, totalPackages };
}
