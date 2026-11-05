# 04: Pembatasan Buku Satuan Terkunci BOM & Whitelist Override Admin

**What to build:**
Pada portal publik pemesanan buku satuan (`PublicOrderView`), daftar buku satuan yang dapat dibeli oleh murid dibatasi secara ketat hanya pada buku-buku yang terdaftar dalam komponen (BOM) paket jenjang dan sekolah murid yang bersangkutan. Admin Pusat juga dapat mengonfigurasi izin buku satuan tambahan (override/whitelist) per sekolah dan jenjang melalui tabel `school_grade_allowed_books`. Ini mencegah murid salah memesan buku di luar kurikulum atau jenjang sekolahnya, sekaligus memberikan fleksibilitas bagi sekolah yang membutuhkan pengadaan buku suplemen satuan khusus.

**Blocked by:** 03: Penugasan Paket Cabang, Edit Komposisi BOM & Delete Paket Buku

**Status:** ready-for-agent

- [ ] Skema tabel D1 `school_grade_allowed_books` (`school_id`, `grade_level`, `book_id`) terdaftar di schema Drizzle dengan relasi dan indeks komposit.
- [ ] Endpoint backend `/api/public/orders/satuan-catalog` diperluas untuk menerima parameter identitas murid (`schoolId` dan `gradeLevel`):
  - Mengambil daftar buku dari BOM paket yang aktif untuk sekolah dan jenjang tersebut (memperhitungkan paket khusus cabang maupun paket universal).
  - Menggabungkan daftar buku dari tabel whitelist override `school_grade_allowed_books` untuk sekolah & jenjang tersebut.
  - Mengembalikan daftar buku satuan yang relevan saja (tanpa membocorkan buku jenjang/kurikulum lain).
- [ ] Tampilan pemesanan portal publik (`PublicOrderView`) mengirimkan konteks sekolah & jenjang murid saat memuat katalog buku satuan, sehingga dropdown buku hanya menampilkan opsi yang valid.
- [ ] Antarmuka staf admin di menu Pengaturan/Katalog menyediakan manajemen sederhana untuk menambah dan mencabut buku override satuan per sekolah dan jenjang.
- [ ] Automated tests memverifikasi filter katalog satuan terkunci BOM dan penggabungan buku override admin.
