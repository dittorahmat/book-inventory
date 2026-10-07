## Purpose

Menyediakan pemicu dialog unggah berkas bukti tanda tangan basah dan cap pada Purchase Order yang responsif, terhubung langsung ke file picker sistem operasi, dan memiliki status interaksi yang jelas.

## ADDED Requirements

### Requirement: Pemicu dialog pemilihan berkas bukti tanda tangan
Sistem SHALL menyediakan tombol interaktif pada PO berstatus dicetak (`printed`) yang saat diklik langsung memicu dialog pemilihan berkas sistem operasi (File Explorer / file picker dialog) tanpa henti atau kegagalan klik bisu.

#### Scenario: Pengguna mengklik tombol Upload Bukti TTD
- **WHEN** pengguna mengklik tombol "Upload Bukti TTD" pada baris PO berstatus `printed` atau pada panel langkah berikutnya di pratinjau cetak
- **THEN** sistem segera membuka dialog pemilihan berkas browser/OS dengan filter tipe berkas gambar (JPEG, PNG, WebP) dan dokumen PDF

#### Scenario: Interaksi tombol saat proses pengunggahan berlangsung
- **WHEN** berkas telah dipilih dan permintaan unggah sedang dikirim ke server (`isUploading` bernilai benar)
- **THEN** tombol upload dinonaktifkan (`disabled`) dan menampilkan status teks "Mengunggah..." dengan animasi visual loading

### Requirement: Penyelesaian unggah dan pembaruan alur PO
Sistem SHALL memperbarui status antarmuka dan data PO setelah berkas bukti tanda tangan berhasil diunggah ke server.

#### Scenario: Unggah bukti tanda tangan berhasil
- **WHEN** berkas berhasil diunggah dan server merespons dengan status sukses
- **THEN** sistem memanggil pembaruan data PO (`onChanged`), menampilkan pesan sukses, memperbarui status PO menjadi `signed_uploaded`, serta menampilkan tautan/pratinjau berkas yang baru diunggah
