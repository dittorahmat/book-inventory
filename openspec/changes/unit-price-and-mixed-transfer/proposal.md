## Why

Bundling paket buku sudah punya harga (`book_packages.price`) yang dipakai untuk penagihan murid, tetapi stok satuan (katalog `books` + fisik `book_items`) tidak punya harga master sama sekali — satu-satunya harga satuan yang ada bersifat transaksional di `purchase_order_items.unitPrice` dan hilang saat barang masuk gudang. Akibatnya transfer antar sekolah hanya bisa memindahkan eksemplar fisik tanpa nilai nominal, tidak bisa mengirim dalam bentuk paketan, dan surat jalan tidak mencerminkan nilai barang yang dipindahkan.

## What Changes

- Tambah harga satuan master di katalog buku (`books.price`, integer rupiah, default 0) dengan input manual saat create buku + validasi edit.
- Backfill/seed harga untuk 12 judul demo existing di `src/server/seed.ts` (Cambridge / Nasional / Diniyyah / Tahfidz).
- Tampilkan harga satuan di Catalog, Inventory (loose stock), dan BOM breakdown PackagesView.
- Perluas transfer inter-school menjadi dua jenis baris dalam satu surat jalan:
  - Satuan: pilih barcode `book_items` (seperti sekarang) + snapshot harga satuan otomatis dari `books.price`.
  - Paketan fisik: pilih barcode bundel `package_items` yang berstatus `in_stock` + snapshot harga paket otomatis dari `book_packages.price`. Stok paket termonitor: dispatch mengubah bundel menjadi `dispatched` (ready asal berkurang), receive memindahkan `current_school_id` dan mengembalikan `in_stock` (tujuan bertambah). Discrepancy: `damaged` → `in_stock` tujuan + catatan, `missing` → baris paket dihapus.
- Tambah total nilai nominal di header shipment (`total_declared_value`) yang dihitung server dari jumlah snapshot baris; tahap ini bersifat informatif (ditampilkan di daftar, form, dan detail surat jalan), skema disiapkan agar bisa naik ke pembukuan resmi tanpa migrasi ulang.
- Lifecycle status shipment tidak berubah (`draft -> in_transit -> completed / completed_with_discrepancy`); yang berubah hanya objek yang ikut bergerak (satuan + bundel fisik).

## Capabilities

### New Capabilities
- `book-unit-price`: harga satuan master per judul katalog — create/edit/seed/backfill, tampil di katalog & stok, dipakai sebagai acuan snapshot transfer.
- `valued-mixed-transfer`: transfer campuran satuan + paketan virtual dengan snapshot harga per baris dan total nominal header yang informatif.

### Modified Capabilities
- Tidak ada spec existing yang diubah strukturnya; delta ini memperluas perilaku `book-catalog` (tambah atribut harga) dan `inter-school-transfer` (tambah jenis baris + nominal) tanpa menghapus kontrak lama. Karena repo ini menyimpan spec per-change (tidak ada `openspec/specs/` pusat), kedua capability di atas ditulis sebagai spec baru dalam change ini.

## Impact

- Affected schema: `books` (+1 kolom), `transfer_shipments` (+ total nominal), `transfer_shipment_items` (kolom polimorfik item + snapshot harga) atau tabel pendamping paket virtual — keputusan final di `design.md`.
- Affected APIs: `booksRouter` (POST/GET + validasi harga), `shipmentsRouter` (create/detail/list + dispatch/receive tanpa ubah lifecycle), `packagesRouter` read-only untuk dropdown paket.
- Affected UI: `CatalogView` (form + kolom harga), `InventoryView` (kolom harga), `PackagesView` (BOM breakdown + harga), `TransfersView` + `InventoryView` quick-transfer (tab Satuan/Paketan + total live).
- Migrations: wajib `bun run db:generate` + `drizzle/*.sql` + eksekusi remote D1 (`wrangler d1 execute --remote --file=...`) + verifikasi `PRAGMA table_info`; backfill harga demo.
- Tests: tambah skenario di `books.test.ts`, `shipments.test.ts` (satuan + paket + total, custom string IDs + UUID, snapshot tidak berubah saat master berubah).
- Constraints: patuhi `z.string().min(1)` untuk semua ID baru, file-size gate 300 baris (`scripts/check-file-size.ts`), anti-slop UI `design-taste-frontend`, dan quality checklist `AGENTS.md` (type-check, lint, build, test).
