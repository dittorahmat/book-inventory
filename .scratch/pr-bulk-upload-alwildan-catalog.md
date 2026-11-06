## Ringkasan Perubahan (Summary)
PR ini menghadirkan dukungan impor masal terpadu untuk **Katalog Buku Al-Wildan TA 2026/2027** dan **Data Siswa**, dengan kemampuan membaca file spreadsheet multi-sheet dan folder Google Drive secara simultan (*batch folder processing*) dilengkapi indikator progress bar dan live status.

---

### Fitur Utama yang Dikerjakan:
1. **Core Multi-Sheet & Header Parser Al-Wildan (`src/lib/book-import-parser.ts`)**:
   - Mendeteksi multi-sheet numerik tingkat kelas (`1` s.d. `6`) dan melompati sheet rekapitulasi summary.
   - Normalisasi variasi header newline & whitespace (`Harga/Unit (Rp)`, `NAMA BUKU`, `No`, dsb.).
   - Auto-tagging penerbit cerdas berbasis judul: `Cambridge` vs `Al-Wildan Press`.
   - Fallback ISBN deterministik berformat kode buku internal (`BK-SD{grade}-{slug}`) bila nomor ISBN tidak tersedia di spreadsheet.

2. **Backend Services & Zero-Filesystem Cloudflare Worker Compatibility**:
   - Ekstraksi seam terpadu [`src/server/services/drive-service.ts`](file:///D:/development/book-inventory/src/server/services/drive-service.ts) untuk membaca berkas/folder Google Drive via Web Standard `fetch` in-memory stream tanpa menyentuh disk fisik.
   - Endpoint `/api/books/parse-drive-url` dan `/api/students/parse-drive-url` dengan skema Zod `.strict()`.
   - Auto-bundling paket buku (`book_packages` & `book_package_items` BOM) dengan penyelarasan harga otomatis all-in via `recalcPackagePrice` kanonik.

3. **Batch Folder Runner Interaktif & Progress Bar**:
   - Komponen kanonik [`DriveFolderBatchRunner.tsx`](file:///D:/development/book-inventory/src/components/ui/DriveFolderBatchRunner.tsx): progress bar persentase (`0%` - `100%`), current file spinner, dan live status counter per file.
   - Diintegrasikan ke [`BookBulkUploadModal.tsx`](file:///D:/development/book-inventory/src/components/books/BookBulkUploadModal.tsx) dan [`StudentBulkUploadModal.tsx`](file:///D:/development/book-inventory/src/components/students/StudentBulkUploadModal.tsx).
   - Ekstraksi custom hook [`useDriveFolderIntake.ts`](file:///D:/development/book-inventory/src/components/ui/useDriveFolderIntake.ts) untuk deduplikasi modal state coordination.

4. **Linter & Architectural Guardrails**:
   - Penambahan gate otomatis `check:test-dom` di `scripts/check-test-dom.ts` dan integrasi ke `check:fast` & `check:all`.
   - Pembaruan aturan konvensi di [`AGENTS.md`](file:///D:/development/book-inventory/AGENTS.md) (§0.55).

---

### Verifikasi Kualitas
- `bun test`: Seluruh 15 unit/komponen/route test suite lulus (100% pass).
- `check:fast` & architectural gates: `type-check`, `check:file-size` (<400 baris), `check:api-contract`, `check:single-writer`, `check:dead`, `check:test-dom` seluruhnya hijau.
