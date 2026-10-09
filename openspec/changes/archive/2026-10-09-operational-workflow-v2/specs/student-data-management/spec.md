## Purpose

Menyediakan antarmuka dan API untuk mengedit data siswa secara individu serta mengimpor data siswa secara massal menggunakan file Excel/CSV dengan penanganan duplikasi via upsert.

## ADDED Requirements

### Requirement: Edit Data Siswa
Sistem SHALL menyediakan antarmuka bagi admin cabang atau admin sistem untuk mengubah profil data siswa (nama, kelas, NIS, nama wali, kontak wali/telepon).

#### Scenario: Berhasil mengubah data siswa
- **WHEN** admin membuka modal edit siswa dan mengubah nomor telepon wali kemudian menekan tombol simpan
- **THEN** data siswa diperbarui dan perubahan langsung terlihat pada daftar siswa

#### Scenario: Validasi data wajib edit siswa
- **WHEN** admin mengosongkan nama siswa atau kelas saat melakukan pengeditan
- **THEN** sistem menolak permintaan dengan pesan kesalahan validasi yang jelas

### Requirement: Unduh Template File Impor Siswa
Sistem SHALL menyediakan tombol unduh template sampel file impor berformat CSV atau Excel dengan kolom standar (NIS, Nama Siswa, Kelas, Nama Wali, No Telepon/WA).

#### Scenario: Unduh template sampel
- **WHEN** pengguna menekan tombol "Unduh Template Impor"
- **THEN** browser mengunduh file template sampel dengan struktur kolom yang sesuai

### Requirement: Bulk Upload Siswa dengan Logika Upsert
Sistem SHALL mendukung pengunggahan file CSV/Excel data siswa dengan validasi tiap baris dan melakukan operasi upsert (memperbarui baris jika NIS sudah ada di cabang yang bersangkutan, atau menambah baris baru jika NIS belum terdaftar).

#### Scenario: Unggah berhasil dengan kombinasi data baru dan pembaruan
- **WHEN** pengguna mengunggah file berisi 20 baris siswa (15 siswa baru dan 5 siswa dengan NIS yang sudah ada)
- **THEN** sistem memasukkan 15 data baru, memperbarui 5 data lama, dan menampilkan ringkasan hasil impor (berhasil, diperbarui, dan gagal bila ada)

#### Scenario: Penanganan baris invalid pada file impor
- **WHEN** terdapat baris data dalam file impor yang tidak memiliki nama atau format kelas tidak valid
- **THEN** sistem melaporkan nomor baris yang bermasalah tanpa membatalkan baris lain yang valid atau menginformasikan kesalahan secara transparan
