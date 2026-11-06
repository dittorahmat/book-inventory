## Ringkasan Perubahan

Fitur bulk upload terpadu untuk siswa & katalog buku, serta pembersihan data operasional di database lokal dan Cloudflare D1 Remote (`book-inventory-db`).

### 1. Pembersihan Data Terpadu (Lokal & Remote D1)
- Disediakan script `scripts/purge-d1.ts` dan runner resmi `scripts/d1-remote.ts` untuk membersihkan data operasional (orders, receipts, allocations, stock, returns, PO) tanpa menghapus master sekolah (`schools`) dan akun user admin (`users`).
- Seluruh 713 data siswa aktif dari berkas aktual sekolah telah tersimpan dan terverifikasi di remote D1.

### 2. Smart Student Bulk Upload (`StudentBulkUploadModal.tsx`)
- Mendukung berkas Excel native `.xlsm`, `.xlsx`, `.csv`, dan tautan Google Sheets publik via utilitas netral `src/lib/sheets.ts`.
- Normalizer cerdas untuk format kelas Al-Wildan (`1.INTER 1` -> jenjang 1, kurikulum internasional; `2.MQ 2` -> jenjang 2, kurikulum nasional).
- Baris khusus (seperti siswa berstatus 'Cuti') otomatis dideteksi dan dilewati pada ringkasan pratinjau.

### 3. Book Catalog Bulk Upload (`BookBulkUploadModal.tsx` & Seam `book-catalog-import.ts`)
- Penambahan endpoint `POST /api/books/bulk-import` yang didelegasikan ke domain service seam `src/server/services/book-catalog-import.ts`.
- Mematuhi mandat batching D1 (`chunkRows(..., 10)`) dan fallback otomatis ke ISBN resolver jika kosong.
- Komponen antarmuka `BookBulkUploadModal` dan tombol pemicu di `CatalogToolbar.tsx` / `CatalogView.tsx`.

### 4. Penguatan Standar & Retrospektif
- Menambahkan aturan R3 pada `scripts/check-d1-writes.ts` untuk memblokir perulangan mutasi Drizzle di file router.
- Memperbarui aturan §0.52 di `AGENTS.md`.
- Seluruh automated gates (`check:fast`, lint, type-check, api-contract, clean-artifacts, file-size, d1-writes) berstatus HIJAU.
