# 04: End-to-End Verification & Bulk Upload Acceptance Test

**What to build:**
Pengujian integrasi dan verifikasi end-to-end atas seluruh alur bulk upload: upload data murid aktual dan buku, pengecekan konsistensi data di UI dan D1 remote, serta verifikasi kelulusan seluruh gate kualitas (`check:fast` & `check:all`).

**Blocked by:** 02: Smart Student Bulk Upload, 03: Book Catalog Bulk Upload

**Status:** ready-for-agent

- [ ] Pengujian upload aktual file `DATA SISWA SD AL-WILDAN 1 TP. 2026-2027.xlsm`
- [ ] Pengujian upload katalog buku via Excel/CSV
- [ ] Verifikasi di halaman StudentsView dan BooksView
- [ ] Semua automated gates hijau (`bun run check:fast`)
