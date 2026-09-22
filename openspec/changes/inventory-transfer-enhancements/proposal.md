## Why

Pengguna dan staf cabang perpustakaan membutuhkan alur kerja yang lebih cepat dan fleksibel dalam mengelola katalog dan mutasi buku antar cabang:
1. Menemukan buku di katalog membutuhkan fasilitas search bar cepat.
2. Proses transfer antar cabang memerlukan penanda alasan/kategori pengiriman (`reason`) dan visibilitas kondisi fisik buku (`condition`) yang jelas (misal: distribusi baru dari pusat, atau retur buku rusak dari cabang ke pusat).
3. Staf cabang membutuhkan kemampuan sortir cepat berdasarkan kondisi buku serta aksi langsung (*bulk transfer*) dari tab Branch Inventory tanpa harus menginput kode barcode secara manual satu per satu di tab transfer.

## What Changes

- **Book Catalog Search Bar**: Input pencarian client-side instan berdasarkan Judul, ISBN, Pengarang, dan Penerbit di halaman katalog buku.
- **Transfer Reason Field**: Penambahan atribut `reason` (teks opsional) pada pengiriman transfer antar cabang untuk mendokumentasikan tujuan mutasi (e.g. "Retur buku rusak", "Distribusi stok baru", "Bantuan operasional cabang").
- **Item Condition Flag in Transfers**: Tampilan indikator badge kondisi fisik (`new`, `good`, `fair`, `damaged`) pada daftar item yang dikirim dan diterima pada modul Interschool Transfers.
- **Branch Inventory Condition Filter**: Dropdown/filter pill untuk menyaring inventaris cabang berdasarkan kondisi fisik item (`All`, `New`, `Good`, `Fair`, `Damaged`).
- **Branch Inventory Multi-Select & Quick Transfer**: Checkbox multi-select pada tabel inventaris cabang dengan action bar mengambang untuk langsung membuat transfer/retur draf ke sekolah tujuan (HQ maupun cabang lain).

## Capabilities

### New Capabilities
- `catalog-search`: Pencarian metadata buku secara instan pada antarmuka katalog buku.
- `inventory-quick-transfer`: Seleksi massal item inventaris cabang dan pembuatan transfer draf secara langsung dengan filter kondisi.
- `transfer-condition-tracking`: Dokumentasi alasan pengiriman (`reason`) serta pelacakan visual kondisi fisik item pada proses mutasi antar sekolah.

### Modified Capabilities
<!-- None -->

## Impact

- **Database**: Penambahan kolom `reason` (text nullable) pada tabel `transfer_shipments` di `src/db/schema.ts` serta pembaruan migrasi D1 & SQLite.
- **Backend API**:
  - `POST /api/shipments` mendukung field opsional `reason`.
  - Endpoint transfer items mengembalikan status `condition` fisik item asal untuk ditampilkan di UI.
- **Frontend Views**:
  - `CatalogView.tsx`: Penambahan search input bar.
  - `InventoryView.tsx`: Penambahan filter condition, multi-select rows, floating bulk-action toolbar, dan modal Quick Transfer.
  - `TransfersView.tsx`: Penambahan input/tampilan `reason` dan badge `condition` item.
- **Tests**: Pengujian otomatis untuk endpoint transfer dengan `reason` dan fungsi filter/search.
