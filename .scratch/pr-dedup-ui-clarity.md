## Ringkasan Perubahan

Menyempurnakan kejelasan dan transparansi penyajian data pada alur import masal (batch folder Google Drive dan file Excel/CSV):
1. **DriveFolderBatchRunner**: Menampilkan perincian jumlah baris mentah yang dibaca akumulatif di seluruh berkas vs jumlah item unik yang berhasil disaring (`Total data terbaca: X baris → Disaring menjadi Y item unik (Z duplikat otomatis diabaikan)`).
2. **BookBulkUploadModal & BookImportPreview**: Menampilkan status judul buku unik siap impor dan counter duplikat yang disaring, serta tombol aksi yang mencerminkan jumlah judul riil (`Simpan {n} Judul Buku ke Katalog`).
3. **StudentBulkUploadModal & StudentImportPreview**: Menampilkan status siswa unik (berdasarkan NIS) dan counter duplikat NIS yang disaring, serta tombol aksi yang mencerminkan jumlah siswa riil (`Simpan {n} Data Siswa`).

## Verifikasi
- Unit test suite lolos (`bun test src/components/ui/DriveFolderBatchRunner.test.tsx src/components/books/BookBulkUploadModal.test.tsx src/components/students/StudentBulkUploadModal.test.tsx`).
- Seluruh gate `check:fast` (type-check, eslint, file-size < 400 lines, dead exports, single writer, no-any, test isolation) lolos hijau.
