# 04: UI Bulk Upload Modal Terpadu (Folder Drive + File) untuk Buku & Siswa

**What to build:**
Pembaruan antarmuka pengguna pada `BookBulkUploadModal.tsx` dan `StudentBulkUploadModal.tsx` sehingga pengguna dapat memasukkan link folder Google Drive publik atau file spreadsheet langsung, melihat daftar file yang terdeteksi di folder, memicu import, serta memilih opsi auto-bundle paket buku.

**Blocked by:** 02: Shared Helper & Service Ekstraksi Google Drive Folder Publik, 03: Auto-Bundling Paket Buku (BOM) & Backend Bulk Import Enhancement

**Status:** ready-for-agent

- [ ] Input modal mendukung link folder Google Drive dan mendeteksi daftar spreadsheet di dalamnya
- [ ] Tersedia opsi checkbox 'Otomatis buat Paket Buku (BOM) per Tingkat Kelas'
- [ ] Preview pratinjau buku dan siswa menampilkan ringkasan data hasil parsing dengan benar
- [ ] Uji coba interaksi modal lulus type-check dan linting
