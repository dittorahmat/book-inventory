## Purpose

Portal orang tua memesan paket buku tanpa memilih manual: hasil search siswa menonjolkan Kelas + Kurikulum, sistem mengunci tepat 1 paket yang cocok, dan layar paket menampilkan rincian isi buku atau empty state hubungi admin.

## ADDED Requirements

### Requirement: Hasil search siswa menonjolkan Kelas dan Kurikulum

Setiap baris hasil `GET /api/public/orders/search-students` di portal SHALL menampilkan nama, NIS, kelas saat ini -> kelas target (untuk status naik kelas), tipe kurikulum (Internasional / Nasional), dan nama sekolah sebagai info utama, bukan teks sekunder kecil.

#### Scenario: Siswa naik kelas tampil target kelasnya

- **WHEN** orang tua mencari "Hendra" dan siswa berstatus `promoted` dari Kelas 1 Internasional
- **THEN** baris hasil menampilkan "Hendra Wahyudi", "NIS 2024101001", "Kelas 1 -> Naik ke Kelas 2", "Kurikulum Internasional", dan sekolahnya

#### Scenario: Siswa aktif tampil kelas berjalan

- **WHEN** orang tua mencari "Aisyah" yang berstatus `active` di Kelas 1 Internasional
- **THEN** baris hasil menampilkan "Kelas 1" dan "Kurikulum Internasional" tanpa label naik kelas

### Requirement: Paket buku terkunci otomatis per siswa

Setelah siswa dipilih, sistem SHALL mengunci tepat 1 paket hasil pencocokan `(targetGradeLevel, curriculumType, academicYear)` tanpa dropdown atau opsi ganti paket di Step 2.

#### Scenario: Satu paket cocok langsung terkunci

- **WHEN** siswa target Kelas 2 Internasional dipilih dan paket `PKG-SD2-INT` tersedia
- **THEN** Step 2 langsung menampilkan paket tersebut sebagai satu-satunya paket, tombol lanjut aktif, dan tidak ada daftar paket lain yang bisa diklik

#### Scenario: Data demo mencakup pasangan INT dan NAS

- **WHEN** seed demo dijalankan
- **THEN** tersedia minimal 1 siswa + 1 paket yang cocok untuk tiap kombinasi demo (mis. Kelas 1 INT, Kelas 1 NAS, Kelas 2 INT, Kelas 2 NAS) sehingga flow terkunci bisa didemokan tanpa kena empty state

### Requirement: Layar paket menampilkan rincian isi buku

Layar Step 2 SHALL menampilkan nama paket, harga, tahun ajaran, dan daftar rincian buku dari `items[]` (judul, ISBN, qty) untuk paket yang terkunci.

#### Scenario: Orang tua melihat isi paket sebelum bayar

- **WHEN** paket Kelas 2 Internasional terkunci untuk Hendra
- **THEN** layar menampilkan daftar bukunya (mis. 8 judul + qty masing-masing), total item, dan harga Rp 1.950.000 sebelum tombol "Lanjut ke Pembayaran"

### Requirement: Empty state paket belum tersedia

Jika tidak ada paket cocok untuk `(targetGradeLevel, curriculumType)`, sistem SHALL menampilkan empty state "Paket belum tersedia, hubungi admin sekolah" dan tombol "Ubah Murid", tanpa tombol lanjut pembayaran.

#### Scenario: Paket kelas belum ada

- **WHEN** siswa target Kelas 5 Nasional dipilih tetapi tidak ada paket Kelas 5 NAS
- **THEN** Step 2 menampilkan pesan hubungi admin dan hanya menyediakan tombol kembali, order tidak bisa disubmit

### Requirement: Skenario demo flow terkunci terdokumentasi

`docs/DEMO_SCENARIO.md` SHALL memuat langkah demo untuk (a) pemesanan terkunci berhasil (search -> detail buku -> bayar) dan (b) empty state paket belum tersedia, dengan keyword search dan NIS yang sesuai data seed.

#### Scenario: Demo bisa diikuti tanpa menebak data

- **WHEN** pendemo mengikuti Skenario 1 baru dengan keyword yang tertulis (mis. "Hendra")
- **THEN** hasil search, paket terkunci, dan rincian buku yang muncul sesuai dengan yang tertulis di dokumen
