## Ringkasan Perubahan

Pull Request ini mengatasi kendala pendaftaran katalog buku dan memperbaiki penyajian pesan error validasi di seluruh aplikasi:

1. **Format Pesan Validasi Zod Ramah Pengguna**:
   - Memperbaiki seam fetch klien `readJson` di `src/lib/api.ts` agar mengekstrak array `error.issues` Zod menjadi pesan teks deskriptif per field (`field: message`).
   - Mencegah string default JavaScript `[object Object]` muncul di alert/modal saat validasi server gagal (berlaku universal untuk semua form/endpoint).

2. **Fleksibilitas Nomor ISBN & Fallback Otomatis**:
   - Menghapus validasi format kaku minimal 10 digit ISBN pada endpoint pembuatan buku `POST /api/books`. Pengguna bebas menggunakan identifier buku internal berapapun panjangnya.
   - Bila ISBN dikosongkan, server otomatis menghasilkan identifier unik berformat `AUTO-${stamp}-${serial}` melalui helper kanonik `resolveBookIsbn` (`src/lib/isbn.ts`) guna menjaga keunikan constraint relasional database SQLite/D1 (`books.isbn NOT NULL UNIQUE`).

3. **Penyesuaian UI Form Pendaftaran Buku**:
   - Di `src/components/catalog/CreateBookForm.tsx`, input ISBN diubah menjadi opsional: mencabut atribut `required`, memperbarui label menjadi `Nomor ISBN / Kode Buku (opsional)`, dan menyesuaikan placeholder.

4. **Testing & Dokumentasi Anti-Kambuh**:
   - Menambahkan unit regression test di `src/lib/api.test.ts`, `src/lib/isbn.test.ts`, `src/server/routes/books.test.ts`, dan test komponen DOM di `src/components/catalog/CreateBookForm.test.tsx`.
   - Mengabadikan aturan anti-kambuh §0.50 dan §0.51 di `AGENTS.md`.

## Verifikasi
- `bun test src/lib/api.test.ts src/lib/isbn.test.ts src/server/routes/books.test.ts src/components/catalog/CreateBookForm.test.tsx`: 26 pass (0 fail).
- `bun run check:fast`: Semua gate hijau (eslint, type-check, clean-artifacts, file-size, no-any, single-writer, dll.).
