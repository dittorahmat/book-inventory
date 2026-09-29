## Purpose

Menjamin setiap pemesanan paket buku lewat portal orang tua selalu selesai dengan kepastian: berhasil tercatat, atau gagal dengan pesan yang dimengerti manusia — tidak pernah lagi error teknis mentah, baik di jalur reguler, beasiswa, maupun retur publik.

## ADDED Requirements

### Requirement: Envelope error JSON untuk semua kegagalan API portal

Sistem SHALL mengembalikan respons JSON `{ success: false, message: <pesan manusiawi> }` untuk setiap kegagalan pada endpoint portal publik (`/api/public/orders/*`), termasuk kegagalan tak terduga (500). Pesan 500 wajib generik ("Terjadi kendala pada server...") dan TIDAK BOLEH membocorkan stack trace atau detail internal.

#### Scenario: Validasi gagal dikembalikan sebagai JSON

- **WHEN** portal mengirim payload submit yang tidak valid (mis. tanpa `studentId`)
- **THEN** server merespons status 4xx dengan body JSON berisi `success: false` dan `message` berbahasa Indonesia yang menjelaskan field yang salah

#### Scenario: Kegagalan internal tetap berupa JSON

- **WHEN** terjadi kegagalan tak terduga saat memproses submit order (mis. storage gagal)
- **THEN** server merespons status 500 dengan body JSON berisi `success: false` dan pesan generik, dan frontend menampilkannya apa adanya tanpa error parse

### Requirement: Frontend portal tahan terhadap respons non-JSON

Portal SHALL menampilkan pesan manusiawi setiap kali respons server bukan JSON valid (mis. halaman error proxy, Worker crash). Portal TIDAK BOLEH menampilkan pesan teknis seperti `Unexpected token ... is not valid JSON` kepada orang tua.

#### Scenario: Submit menerima respons non-JSON

- **WHEN** `submitFinalOrder` menerima body respons yang bukan JSON
- **THEN** portal menampilkan "Gagal memproses pesanan buku. Periksa koneksi Anda lalu coba lagi." dan tetap di Step 3 (tidak pindah step, data form tidak hilang)

#### Scenario: Gagal memuat data awal menampilkan pesan yang jelas

- **WHEN** `fetchSchools` atau `fetchPackages` gagal (non-JSON atau network error)
- **THEN** portal menampilkan pesan spesifik ("Gagal memuat daftar sekolah/paket buku...") dan tombol Cari Data dinonaktifkan sampai data berhasil dimuat

### Requirement: Error lama tidak terbawa antar step

Portal SHALL menghapus pesan error setiap kali pengguna berpindah step wizard atau berpindah tab portal, sehingga banner error selalu mencerminkan operasi terakhir saja.

#### Scenario: Error step awal hilang saat lanjut

- **WHEN** pengguna melihat error di Step 1 lalu berhasil lanjut ke Step 2
- **THEN** banner error tidak lagi tampil di Step 2 maupun Step 3

### Requirement: Submit jalur reguler mencatat order dan pembayaran secara utuh

Sistem SHALL membuat pesanan jalur reguler beserta catatan pembayaran (bila ada alokasi buku > 0) dalam keadaan konsisten: catatan pembayaran selalu merujuk pada order yang sudah ada, status bayar `paid` bila alokasi melunasi total dan `partial` bila kurang, termasuk saat bukti transfer dilampirkan sebagai base64.

#### Scenario: Submit reguler lunas dengan bukti transfer

- **WHEN** orang tua submit jalur reguler dengan alokasi buku sama dengan harga paket plus foto bukti transfer
- **THEN** server merespons 201, order berstatus `unpaid`→`paid` sesuai alokasi, dan URL bukti pembayaran tersimpan pada catatan pembayaran

#### Scenario: Submit reguler parsial

- **WHEN** orang tua submit jalur reguler dengan alokasi buku kurang dari harga paket
- **THEN** server merespons 201 dan order berstatus `partial` dengan `paidAmount` sebesar alokasi

### Requirement: Submit jalur beasiswa gratis dengan bukti wajib

Sistem SHALL menolak submit beasiswa tanpa lampiran surat beasiswa (400 + pesan jelas), dan menerima submit ber-Dokumen dengan `totalAmount` 0 serta status `scholarship_pending` hingga diverifikasi sekolah.

#### Scenario: Beasiswa tanpa dokumen ditolak

- **WHEN** orang tua submit jalur beasiswa tanpa `scholarshipProofBase64`
- **THEN** server merespons 400 JSON "Surat tanda beasiswa wajib dilampirkan" dan tidak ada order yang tercipta

#### Scenario: Beasiswa dengan dokumen tercatat menunggu verifikasi

- **WHEN** orang tua submit jalur beasiswa beserta dokumen
- **THEN** server merespons 201, `totalAmount` 0, `paymentStatus` `scholarship_pending`, dan URL bukti beasiswa tersimpan pada order
