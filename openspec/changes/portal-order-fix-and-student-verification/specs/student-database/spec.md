## Purpose

Memberi staf sekolah database siswa yang dapat dikelola (cari, filter, tambah, ubah) sekaligus pintu verifikasi manual: tidak ada lagi siswa baru yang bisa memesan buku sebelum disetujui admin, dengan status yang selalu jelas bagi orang tua maupun admin.

## ADDED Requirements

### Requirement: Database siswa di panel admin dengan isolasi cabang

Sistem SHALL menyediakan tab "Database Siswa" di panel staf yang menampilkan daftar siswa dengan pencarian (nama/NIS), filter (sekolah, tingkat kelas, status), serta tambah dan ubah data. `central_admin` melihat semua sekolah; `branch_admin` SHALL hanya melihat dan mengelola siswa sekolahnya sendiri.

#### Scenario: Branch admin terisolasi di sekolahnya

- **WHEN** branch admin Al Wildan 2 membuka Database Siswa
- **THEN** daftar hanya berisi siswa Al Wildan 2, dan upaya akses (URL/API) siswa sekolah lain ditolak

#### Scenario: Pencarian siswa fleksibel

- **WHEN** admin mengetik potongan nama atau NIS minimal 2 karakter
- **THEN** daftar menampilkan siswa yang cocok beserta NIS, kelas, kurikulum, sekolah, dan status verifikasi

### Requirement: Antrian verifikasi siswa baru

Sistem SHALL menampilkan siswa berstatus `new_pending` dalam antrian verifikasi yang jelas (badge + jumlah menunggu). Admin SHALL dapat menyetujui (wajib mengisi NIS resmi — menggantikan NIS sementara `REG-xxxxxx`, status menjadi `active`) atau menolak (status menjadi `rejected`, siswa tidak bisa memesan).

#### Scenario: Approve menerbitkan NIS resmi

- **WHEN** admin menyetujui siswa pending dengan NIS resmi `20260015`
- **THEN** status siswa menjadi `active`, NIS tersimpan `20260015`, dan siswa dapat ditemukan serta dipakai memesan di portal

#### Scenario: Reject memblokir pemesanan

- **WHEN** admin menolak siswa pending
- **THEN** status siswa menjadi `rejected` dan siswa tersebut tidak bisa dipakai memesan (portal maupun API menolak dengan pesan jelas)

### Requirement: Registrasi portal mengunci total sampai diverifikasi

Setelah orang tua mendaftarkan siswa baru, portal SHALL menampilkan layar "Pendaftaran diterima — menunggu verifikasi admin" dan TIDAK BOLEH melanjutkan ke Step 2 (Detail Paket) maupun Step 3. Pesan wajib menjelaskan bahwa admin akan memverifikasi dan orang tua dapat mencoba lagi setelah disetujui.

#### Scenario: Siswa baru terkunci di layar tunggu

- **WHEN** orang tua selesai mengisi formulir murid baru dan menekan daftar
- **THEN** portal menampilkan status menunggu verifikasi (bukan detail paket), tanpa tombol lanjut ke pemesanan

### Requirement: Pencarian portal menyembunyikan siswa belum terverifikasi

`search-students` SHALL mengecualikan siswa berstatus `new_pending` dan `rejected` dari hasil, sehingga hanya siswa `active` (dan `promoted`) yang bisa dipilih untuk memesan.

#### Scenario: Siswa pending tidak muncul di pencarian

- **WHEN** orang tua mencari nama siswa yang masih `new_pending`
- **THEN** hasil kosong dan portal menawarkan pendaftaran ulang atau pesan menunggu verifikasi, bukan baris siswa yang bisa diklik

### Requirement: Submit order menolak siswa belum terverifikasi

`POST /submit` SHALL menolak `studentId` berstatus selain `active`/`promoted` dengan 403 JSON ("Data siswa menunggu verifikasi admin..."), sebagai pertahanan lapis kedua bila validasi frontend terlewati.

#### Scenario: Submit dengan siswa pending ditolak server

- **WHEN** API menerima submit order untuk siswa `new_pending` (mis. request direkayasa manual)
- **THEN** server merespons 403 JSON dan tidak ada order maupun pembayaran yang tercipta

#### Scenario: Submit dengan siswa aktif tetap diterima

- **WHEN** API menerima submit order untuk siswa `active` dengan payload valid
- **THEN** order diproses normal (201) tanpa terpengaruh gate verifikasi
