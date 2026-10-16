# Book Inventory

Inventaris buku B2B untuk logistik pendidikan: melacak eksemplar fisik antar sekolah cabang, transfer antar gudang, dan pesanan siswa.

## Language

**Book**:
Buku katalog (judul + harga dasar), bukan eksemplar fisik.
_Avoid_: Item, copy

**Book Item**:
Satu eksemplar fisik dengan barcode unik dan sekolah penempatan saat ini.
_Avoid_: Book copy, stock unit

**Transfer Shipment**:
Perpindahan formal eksemplar antar sekolah (`draft` → `pending_dispatch` → `in_transit` → `completed` / `discrepancy`).
_Avoid_: Transfer, mutation

**Supplier PO**:
Dokumen pengadaan buku dari gudang pusat ke penerbit/supplier eksternal (nomor `PO-…`, alur `draft` → `printed` → `signed_uploaded` → `sent` → `received`).
_Avoid_: PO supplier, purchase order manual

**Internal PO**:
Pesanan paket buku dari sekolah cabang ke gudang pusat (nomor `IPO-…`, status `submitted` → `partial_fulfilled` → `completed`), dipenuhi lewat surat jalan pengiriman internal.
_Avoid_: IPO, pesanan cabang

**YAGNI**:
Disiplin hapus kode mati dan kanonikalisasi helper ke modul kanonik, tanpa fitur spekulatif.
_Avoid_: Generalisasi dini, future-proofing

**One-liner**:
Guard/loop setara yang ditulis sebagai `map`/`filter`/`reduce`/`??`/`||`/ternary satu baris tanpa mengubah perilaku.
_Avoid_: Verbose guard, helper sekali-pakai

**Chunked Insert**:
Satu statement `INSERT ... VALUES` maksimal 10 baris, dieksekusi sekuensial agar lolos batas bound-parameter D1.
_Avoid_: Bulk insert, multi-row besar

**Write Batch**:
Tulis induk+anak atomik via satu `db.batch()` di D1 dengan fallback sekuensial di bun-sqlite; `Promise.all` untuk tulis dilarang.
_Avoid_: Concurrent write, parallel insert

**Pencarian Partisi**:
Pencarian substring (`LIKE '%q%'`) yang didahului kesetaraan terindeks (`school_id = ?`); "Salsa" tetap ketemu "Annisa Salsabila" dalam satu sekolah tanpa pindai global.
_Avoid_: Pencarian global, substring tanpa sekolah

**Pindai Penuh**:
Eksekusi `SCAN` tanpa indeks: `SELECT`-all + filter JS atau `LIKE '%q%'` tanpa `schoolId`. Dilarang oleh §11 kecuali katalog kecil.
_Avoid_: Full table scan, filter memori

**FTS**:
Pencarian full-text SQLite (virtual table + trigger) dengan query token-prefix (`salsa*`); hanya Tahap 2 untuk pencarian global bervolume, bukan default.
_Avoid_: LIKE persen-depan global, pencarian fuzzy spekulatif

**Refund**:
Pengembalian dana + restorasi satu baris stok fisik (`RFD-*`) atas komplain buku yang disetujui (`book_returns` → `refunded` + `refundAmount`).
_Avoid_: Retur dana manual, void pembayaran

**Rakit Bundling**:
Perakitan paket buku fisik dari stok satuan lepas sesuai BOM (`book_package_items`), hanya di gudang pusat; padanan istilah flowchart "SPK".
_Avoid_: SPK, perakitan manual

**Bongkar Paket**:
Pengembalian paket rakitan yang tak terpakai menjadi stok satuan lepas (wajib alasan).
_Avoid_: Unbundle manual, retur paket

**Surat Jalan Pemasok**:
Nomor surat jalan dari supplier saat penerimaan PO; duplikat per PO ditolak.
_Avoid_: Delivery note manual, SJ supplier ganda

**Surat Jalan Internal**:
Nomor surat jalan administratif gudang ke cabang; tidak menggerakkan stok fisik — gerakan fisik lewat Transfer Shipment tertaut.
_Avoid_: SJ transfer, surat jalan fisik

**Surat Jalan Serah-Terima**:
Nomor serah-terima paket/satuan-ambil ke siswa saat handover ambil-langsung di sekolah (`SJ-SERAH-*`); tidak dipakai untuk kirim-rumah.
_Avoid_: Resi kurir, SJ pengiriman rumah

**Kirim-Rumah Satuan**:
Distribusi buku satuan ke alamat rumah per order dengan flag `belum_dikirim` → `sudah_dikirim` oleh gudang; ongkir + resi diinput manual gudang, invoice dikirim setelah ongkir terisi (ongkir 0 sah bila ada resi). Paket-ambil tetap diambil di sekolah; paket-kirim ke rumah wajib ongkir sebelum serah-terima.
_Avoid_: Ekspedisi, SJ-SERAH satuan

**Kirim-Rumah**:
Distribusi seragam ke alamat rumah per order dengan flag `belum_dikirim` → `sudah_dikirim` oleh gudang; ongkir + resi diinput manual gudang, invoice dikirim setelah ongkir terisi.
_Avoid_: SJ-SERAH, ekspedisi

**Sisa Stock**:
Stok cabang yang tak terbagi ke siswa; penarikannya memakai pola transfer generik cabang → gudang, tanpa endpoint khusus.
_Avoid_: Pull otomatis, penarikan terjadwal

**Penyesuaian Selisih**:
Penetapan status selisih atas baris berkondisi non-baik (`damaged`/`missing`) saat penerimaan, dengan mutasi stok yang mengikuti.
_Avoid_: Adjust manual, koreksi diam-diam

**Ambil Langsung**:
Model distribusi v1: paket selalu diambil di sekolah dengan berita serah-terima; satuan-ambil juga di sekolah, satuan-kirim ikut Kirim-Rumah Satuan. Tanpa kurir, ongkir, atau pelacakan.
_Avoid_: Delivery paket ke rumah, ekspedisi

**Seragam**:
Katalog varian seragam (bukan buku): kain harian atau olahraga jadi, dibedakan gender × jenjang.
_Avoid_: Pakaian umum, uniform

**Kain Harian**:
Paket kain seragam harian per gender (L/P) × jenjang, tanpa ukuran; pakaian jadi bukan kain harian.
_Avoid_: Seragam harian jadi

**Olahraga Jadi**:
Pakaian olahraga jadi bersize (subset S–10L per jenjang) dengan file size chart per varian.
_Avoid_: Seragam olahraga kain

**Paket Seragam**:
Bundel 1 kain harian + 1 olahraga (gender × jenjang × size), dirakit di gudang pusat.
_Avoid_: Paket campuran bebas

**Kirim-Rumah**:
Distribusi seragam ke alamat rumah per order dengan flag `belum_dikirim` → `sudah_dikirim` oleh gudang; ongkir + resi diinput manual gudang, invoice dikirim setelah ongkir terisi.
_Avoid_: SJ-SERAH, ekspedisi

**Tukar Ukuran**:
Exchange olahraga belum-dipakai ≤14 hari (size lama kembali ke stok, size baru keluar); kain yang sudah dipotong = final sale kecuali cacat.
_Avoid_: Retur tukar umum

**Refund Seragam**:
Dana kembali atas order seragam (cacat/gagal kirim), terpisah dari Tukar Ukuran.
_Avoid_: Void, retur dana manual

**Klaim Cabang**:
Snapshot rekonsiliasi gudang → cabang per periode + sekolah (nomor `CLM-*`, bisa lock); tukar/refund pasca-lock masuk periode berikut.
_Avoid_: Tagihan manual, invoice campur

**WPR**:
Buku Weekly Progress Report 750rb, wajib di BOM semua paket buku dan ditagihkan ke order satuan yang belum punya order paket (termasuk beasiswa). Bukan stok fisik rakitan: dikecualikan dari konsumsi stok saat kitting.
_Avoid_: Fee admin, buku opsional

**Invoice WhatsApp**:
Tagihan satuan dikirim gudang via WA Meta Official setelah ongkir diinput; memuat link konfirmasi `/bayar/buku|seragam/:token` untuk bayar lunas/bertahap termin bebas.
_Avoid_: Tagihan kertas, invoice tanpa link bayar

**Tahap Seragam**:
Status order seragam turunan: pemesanan (belum invoice) → tagihan (invoice terkirim) → konfirmasi (parsial) → lunas.
_Avoid_: Status kirim, status bayar mentah

**Reject**:
Flag ok/reject barang: eksemplar buku via `is_rejected` per barcode; seragam via catatan `uniform_rejects` (varian-size + qty + alasan).
_Avoid_: Kondisi rusak, retur publik
