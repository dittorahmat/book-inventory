## 1. Fondasi Gudang, Peran & Isolasi

- [x] 1.1 Tambah tipe `warehouse` di `schools`, peran `warehouse_admin` + `school_admin` di `users`, dan seed satu baris Gudang Logistik + akun admin gudang; verifikasi via `bun run db:push` dan query seed menampilkan gudang dan akun baru.
- [x] 1.2 Buat helper isolasi (`resolveActor` + `scopeByLocation`) dari pola `DashboardActor` dan pakai di semua route data (procurement, bookItems, packages, shipments, student-orders, payments, dashboard); verifikasi via regression test per route bahwa admin sekolah hanya menerima data lokasinya (`npm run test` hijau).
- [x] 1.3 Migrasi skema fase 1 ke D1 remote dan verifikasi kolom/tipe sinkron (`PRAGMA table_info`); verifikasi via eksekusi SQL migrasi remote tanpa error.

## 2. Model Harga & Diskon PO

- [x] 2.1 Tambah `buy_price` + `sell_price` di `books` dengan fallback baca dari `price` lama, tambah service tulis harga yang memicu `recalcPackagePrice`; verifikasi via test bahwa ubah harga jual menghitung ulang semua paket pemakai.
- [x] 2.2 Jadikan harga paket terkomputasi `SUM(harga jual * qty)` dan isi default harga item PO dari harga beli; verifikasi via test perakitan paket menghasilkan total otomatis dan item PO terisi harga beli.
- [x] 2.3 Tambah `discount_percent` per item PO dan tiga angka header (kotor, diskon, netto) dengan validasi 0–100; verifikasi via test skenario 100 x 50000 diskon 10 persen = netto 4500000 dan penolakan diskon 150 persen.
- [x] 2.4 Migrasi skema fase 2 ke D1 remote dan verifikasi sinkron; verifikasi via `PRAGMA table_info` remote.

## 3. Alur PO Cetak–TTD–Upload–Kirim + Master Supplier

- [x] 3.1 Tambah status `printed` + `signed_uploaded`, kolom referensi berkas bukti, endpoint upload via storage abstraction, dan gerbang server pada aksi kirim; verifikasi via test kirim tanpa bukti ditolak dan kirim setelah upload berhasil.
- [x] 3.2 Kunci `targetSchoolId` PO ke gudang (isi server-side, tolak tujuan non-gudang) dan hapus dropdown tujuan di form; verifikasi via test request tujuan sekolah ditolak dan PO baru selalu bertujuan gudang.
- [x] 3.3 Tambah UI master supplier (daftar/tambah/ubah) di tab PO; verifikasi via test kode duplikat ditolak dan buka tab PO menampilkan daftar supplier.
- [x] 3.4 Tambah tampilan cetak PO dan pratinjau berkas bukti di detail PO; verifikasi via buka detail PO bertanda bukti menampilkan pratinjau/unduhan.

## 4. Ringkasan Stok & Transaksi Kuantitas

- [x] 4.1 Buat endpoint agregasi stok satuan dan paket per judul/paket per lokasi serta perluas ringkasan dashboard; verifikasi via test agregat sama dengan penjumlahan row fisik.
- [x] 4.2 Ubah UI stok ke tampilan summary dan sembunyikan daftar barcode dari alur utama (drill-down fisik hanya gudang/central); verifikasi via buka halaman stok menampilkan satu baris per judul/paket.
- [x] 4.3 Implementasi service `allocateStock` FIFO dan ubah pembuatan transfer/penerimaan/serah terima menjadi input kuantitas; verifikasi via test transfer 10 qty mengalokasikan 10 eksemplar tertua dan satu surat jalan dapat memuat banyak jenis paket.
- [x] 4.4 Kunci perilaku status satuan hasil bundling tidak berubah saat transfer paket; verifikasi via regression test skenario transfer paket bundling.

## 5. Portal Satuan + Cut-off Tahun Ajaran

- [x] 5.1 Tambah order satuan di portal publik (pilih judul + qty, total dari harga jual) dan pengaturan cut-off per tahun ajaran (tanggal WIB + override); verifikasi via test order satuan saat terbuka dan paket-saja saat tertutup.
- [x] 5.2 Implementasi util `todayWIB()` dan aturan default-tertutup (tahun ajaran baru tanpa pengaturan = tertutup); verifikasi via test batas hari UTC-vs-WIB dan skenario rollover Agustus.
- [x] 5.3 Tambah UI admin untuk tanggal efektif dan override per tahun ajaran dengan otorisasi peran; verifikasi via buka pengaturan sebagai admin sekolah ditolak.

## 6. Laporan Penjualan (Asumsi Sementara)

- [x] 6.1 Buat endpoint agregat penjualan (omzet, terkumpul, piutang, jumlah order, pisah paket/satuan, porsi beasiswa) dengan filter periode dan scope isolasi peran; verifikasi via test angka laporan sama dengan penjumlahan order dan admin sekolah terkunci lokasinya.
- [x] 6.2 Buat tab laporan + unduhan CSV dari shape yang sama; verifikasi via unduh CSV berisi data yang sama dengan tampilan.

## 7. Kualitas & Penutup

- [x] 7.1 Jalankan gate kualitas penuh (type-check nol error, lint, build, `check:file-size`, seluruh test hijau) dan perbaiki temuan; verifikasi via semua perintah gate lolos.
- [x] 7.2 Sinkronisasi migrasi remote D1 final dan perbarui akun/data demo (admin gudang, lokasi gudang); verifikasi via skenario demo login tiap peran melihat data yang benar.
