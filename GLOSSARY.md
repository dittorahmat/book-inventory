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
