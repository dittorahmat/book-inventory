## Why

Masukan operasional dari user menunjukkan enam kesenjangan antara perilaku aplikasi dan proses bisnis nyata: alur PO di lapangan wajib cetak → tanda tangan basah + cap → upload sebelum kirim (aplikasi sekarang kirim email langsung); model harga belum memisahkan harga beli/jual dan harga paket masih input manual; UI menampilkan detail ID fisik per eksemplar yang dianggap noise; belum ada peran gudang logistik dan isolasi data per lokasi belum konsisten; belum ada laporan penjualan; dan form publik hanya melayani paket, belum satuan dengan cut-off per tahun ajaran.

## What Changes

- **Alur PO cetak–TTD–upload–kirim**: status baru `printed` dan `signed_uploaded` di antara `draft` dan `sent`; tombol kirim email hanya aktif setelah bukti TTD+cap diupload (R2 / storage lokal VPS). PO lama berstatus `sent` dibiarkan apa adanya (tanpa migrasi).
- **Diskon PO per item dalam persen**: tiap item PO menyimpan `discountPercent` (hasil kesepakatan volume dengan supplier); total PO menampilkan subtotal sebelum diskon, total diskon, dan total setelah diskon.
- **Master supplier di tab PO**: daftar/buka master supplier (tabel sudah ada, belum ada UI) di dalam tab PO.
- **PO selalu ke gudang**: dropdown sekolah tujuan dihapus; `targetSchoolId` otomatis = gudang logistik.
- **Harga beli & harga jual per buku**: `books` mendapat dua field harga; total harga paket = jumlah harga (jual) satuan penyusunnya, bukan input manual.
- **Tampilan summary**: stok satuan dan paket tampil agregat per judul/paket (qty + status + kondisi ringkas); detail ID fisik/barcode disembunyikan dari alur utama; semua transaksi (transfer, serah terima, penerimaan) input berbasis qty dengan auto-alokasi FIFO oleh sistem — user tidak pernah memilih ID fisik.
- **Gudang tunggal + isolasi peran**: satu `Gudang Logistik` sebagai tipe lokasi baru; peran `admin_gudang` dan `admin_sekolah` (menggantikan/memelengkapi `branch_admin`); distribusi ke sekolah hanya lewat inter-school transfer; audit dan penegakan filter `schoolId` di semua route agar admin sekolah hanya melihat datanya sendiri.
- **Laporan penjualan** (asumsi sementara, menunggu detail user): rekap omzet/terkumpul/piutang per periode, sekolah, dan tipe paket-vs-satuan, dengan ekspor CSV.
- **Pemesanan satuan di form publik**: portal mendukung order satuan selain paket; keterbukaan order satuan dikontrol cut-off per tahun ajaran (tanggal efektif WIB + override manual), default tertutup — tahun ajaran baru otomatis tertutup sampai admin mengatur tanggalnya.

## Capabilities

### New Capabilities
- `po-print-sign-workflow`: alur cetak, upload bukti TTD+cap, dan gerbang kirim PO.
- `po-item-discount`: diskon persen per item PO dan total sebelum/sesudah diskon.
- `supplier-master`: manajemen daftar supplier di tab PO.
- `book-pricing`: harga beli & harga jual per buku; harga paket terkomputasi dari harga satuan.
- `inventory-summary`: tampilan agregat stok satuan/paket dan transaksi berbasis qty dengan auto-alokasi.
- `warehouse-and-isolation`: lokasi gudang tunggal, peran admin gudang/sekolah, PO selalu ke gudang, distribusi via transfer, dan isolasi data per peran.
- `sales-report`: laporan penjualan per periode/sekolah/tipe dengan ekspor CSV (asumsi sementara).
- `public-order-satuan`: pemesanan satuan di portal publik dengan cut-off per tahun ajaran (WIB).

### Modified Capabilities
- (Tidak ada — belum ada spec utama di `openspec/specs/`; semua capability di atas bersifat baru sebagai delta.)

## Impact

- **Skema DB**: field/kolom baru di `books` (harga beli/jual), `purchase_order_items` (diskon persen), `purchase_orders` (status baru + referensi dokumen upload), `schools` (tipe `warehouse`), `users` (peran baru), `system_settings` (cut-off satuan per tahun ajaran). Semua butuh migrasi D1 lokal + remote.
- **API**: endpoint PO (cetak/upload/kirim/diskon), endpoint agregasi stok, endpoint laporan, endpoint portal satuan, filter isolasi di semua route.
- **Frontend**: tab PO (master supplier, alur cetak/upload, tanpa dropdown tujuan), views stok/transfer/order berbasis summary, tab laporan baru, form publik satuan + pengaturan cut-off.
- **Seed/demo**: akun dan data demo menyesuaikan (admin gudang, lokasi gudang).
- **Non-goal tahap ini**: migrasi status PO lama; multi-gudang; penghapusan fisik row barcode di DB (tetap disimpan, hanya disembunyikan).
