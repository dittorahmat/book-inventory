## Purpose

Menyediakan standarisasi perilaku tampilan dan interaksi untuk seluruh input angka (harga, kuantitas, diskon, alokasi stok, dan nominal pembayaran) agar nilai 0 tidak menghalangi pengetikan angka baru dan tampil sebagai placeholder bersih tanpa leading zero.

## ADDED Requirements

### Requirement: Tampilan Nilai Nol Sebagai Placeholder
Setiap kolom input angka yang bernilai 0 SHALL menampilkan string kosong sebagai nilai input sehingga placeholder "0" (atau label kontekstual) tampak secara visual kepada pengguna.

#### Scenario: Input angka bernilai awal 0
- **WHEN** komponen atau formulir dimuat dengan state angka bernilai 0
- **THEN** nilai tampilan pada kotak input adalah kosong dan placeholder "0" tampil berwarna pudar

#### Scenario: Input angka bernilai lebih dari 0
- **WHEN** state angka bernilai positif (misalnya 150000 atau 12)
- **THEN** kotak input menampilkan string angka yang sesuai tanpa karakter leading zero ekstra

### Requirement: Pengetikan Nilai Tanpa Prefix Nol
Sistem SHALL memungkinkan pengguna langsung mengetik angka baru pada kolom yang bernilai awal 0 tanpa menyisipkan angka 0 di depan karakter baru.

#### Scenario: Pengguna mengetik angka pada kolom bernilai awal 0
- **WHEN** pengguna memfokuskan kolom input bernilai 0 lalu menekan tombol angka (misalnya '1', '5', '0', '0', '0', '0')
- **THEN** nilai teks yang muncul di kolom input adalah "150000" dan bukan "0150000"

### Requirement: Pengosongan Kolom Menghasilkan Nilai Nol Aman
Sistem SHALL menangani pengosongan nilai input (misalnya pengguna menekan tombol backspace hingga kolom bersih) dengan mengonversi nilai menjadi 0 pada penampung state tanpa menimbulkan nilai NaN.

#### Scenario: Pengguna menghapus isi kolom angka hingga kosong
- **WHEN** pengguna menghapus seluruh teks dari dalam kotak input
- **THEN** handler formulir memperbarui state menjadi 0 dan kotak kembali menampilkan placeholder "0"
