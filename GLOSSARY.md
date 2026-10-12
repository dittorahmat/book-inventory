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
Nomor serah-terima paket/satuan ke siswa saat handover (`SJ-SERAH-*`, ambil langsung, bukan kurir).
_Avoid_: Resi kurir, SJ pengiriman rumah

**Sisa Stock**:
Stok cabang yang tak terbagi ke siswa; penarikannya memakai pola transfer generik cabang → gudang, tanpa endpoint khusus.
_Avoid_: Pull otomatis, penarikan terjadwal

**Penyesuaian Selisih**:
Penetapan status selisih atas baris berkondisi non-baik (`damaged`/`missing`) saat penerimaan, dengan mutasi stok yang mengikuti.
_Avoid_: Adjust manual, koreksi diam-diam

**Ambil Langsung**:
Model distribusi v1: siswa/orang tua mengambil buku di sekolah dengan berita serah-terima; tanpa alamat, kurir, ongkir, atau pelacakan.
_Avoid_: Delivery ke rumah, ekspedisi
