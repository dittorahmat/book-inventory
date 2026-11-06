## Summary

Sinkronisasi penuh katalog buku dari Google Drive ke Cloudflare D1 Remote (`book-inventory-db`) dan perbaikan klasifikasi subfolder Google Drive.

## Perubahan Perilaku

1. **Resolusi Subfolder Google Drive Deterministik**:
   - `src/lib/sheets.ts` mendeteksi subfolder secara akurat lewat atribut `aria-label` Google Drive (mendukung bahasa Inggris & Indonesia), mengeliminasi *false positive* pada nama berkas yang memuat kata 'folder'.
   - `useDriveFolderIntake.ts` memastikan hanya berkas bertipe `spreadsheet` yang dimasukkan ke antrean proses intake.
2. **In-Memory TTL Caching (5 Menit)**:
   - `src/server/services/drive-service.ts` menambahkan cache 5 menit untuk pembacaan folder publik Google Drive, memangkas round-trip berulang pada sesi parsing beruntun.
3. **Database D1 Remote**:
   - Membersihkan data uji coba parsial sebelumnya.
   - Mengunggah **445 judul buku unik** dari folder Drive + 4 buku seed standar (**total 449 judul buku** terdaftar di tabel `books`).
   - Membentuk **22 paket buku** otomatis per jenjang & kurikulum untuk TA 2026/2027 dengan **472 pemetaan relasi buku-paket** di tabel `book_package_items`.
4. **Dokumentasi & Anti-Kambuh**:
   - Menambahkan aturan §0.55.6 dan disiplin eksekusi D1 remote di `docs/rules/database-d1.md`.
