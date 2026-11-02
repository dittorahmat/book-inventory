# 02: Safe Intake Form Tambah Siswa & Bulk Upload Lintas Cabang untuk Staf Gudang

**What to build:**
Pada modal `StudentFormModal` dan `StudentBulkUploadModal`, ketika dibuka dari view dengan filter `"Semua Cabang"` atau oleh staf gudang:
1. `StudentFormModal` mengosongkan default sekolah (`""`) sehingga staf wajib memilih cabang sekolah riil dan tidak salah input ke entitas gudang.
2. `StudentBulkUploadModal` menyediakan pemilih cabang sekolah murid (hanya sekolah non-gudang) jika dipicu saat filter `"all"` aktif.
3. `BatchPromoteModal` dan `StudentsView` memfilter entitas gudang dari daftar pilihan sekolah murid.

**Blocked by:** 01-students-view-warehouse-default-scope

**Status:** ready-for-agent

- [ ] `StudentFormModal` mewajibkan pemilihan cabang valid saat default bernilai kosong atau gudang.
- [ ] `StudentBulkUploadModal` menyediakan selector cabang jika `schoolId` belum ditentukan / `"all"`.
- [ ] Unit test untuk form modal dan upload intake.
