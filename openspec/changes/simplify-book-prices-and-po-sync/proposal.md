# Proposal: simplify-book-prices-and-po-sync

## Why

Feedback dari pengujian pengguna menemukan dua masalah pada alur harga buku dan pengadaan:
1. Pada form tambah dan edit katalog buku, keberadaan tiga input harga ("Harga Dasar", "Harga Beli", dan "Harga Jual") membingungkan pengguna karena konsep "Harga Dasar" dan "Harga Beli" saling tumpang tindih. Pengguna hanya membutuhkan informasi harga perolehan/modal (Harga Beli) dan harga patokan jual ke siswa/paket (Harga Jual).
2. Pada form Purchase Order (PO), ketika pengguna memilih judul buku di daftar pesanan, harga satuan tidak otomatis mengikuti harga katalog dan mengharuskan input manual yang berulang serta rawan salah ketik. Selain itu, pengguna menginginkan harga satuan di PO terkunci (read-only) sesuai harga beli katalog resmi.

Perubahan ini menyederhanakan pengalaman input katalog dan mengotomatiskan pengisian harga satuan PO dari katalog secara konsisten.

## What Changes

- **Penyederhanaan Form Katalog Buku**:
  - Menghapus input "Harga Dasar (Rp)" dari komponen form input dan edit katalog buku (`BookPriceFields`).
  - Menampilkan hanya dua kolom harga: "Harga Beli (Rp)" dan "Harga Jual (Rp)".
  - Menyinkronkan nilai kolom database legacy `price` secara otomatis dari `sellPrice` (atau fallback `buyPrice`) agar API dan skema database yang ada tetap kompatibel tanpa breaking change.
- **Otomatisasi & Proteksi Harga Satuan di PO**:
  - Ketika item buku dipilih atau diganti di dropdown PO (`bookId`), kolom `unitPrice` otomatis diisi dengan Harga Beli buku terkait dari katalog (`effectiveBookPrice(b).buy`).
  - Saat baris buku baru ditambahkan, `unitPrice` baris baru otomatis mengambil Harga Beli buku default.
  - Mengunci input Harga Satuan (`unitPrice`) di form PO menjadi **read-only** dengan styling yang jelas sehingga pengguna tidak perlu menginput manual dan terhindar dari ketidakcocokan harga.

## Capabilities

### New Capabilities
- `catalog-price-simplification`: Penyederhanaan form input harga buku di katalog menjadi Harga Beli dan Harga Jual saja, dengan sinkronisasi otomatis kolom legacy price.
- `po-catalog-price-lock`: Pengisian otomatis harga satuan baris item PO dari harga beli katalog dan penguncian kolom harga satuan menjadi read-only.

### Modified Capabilities
<!-- Tidak ada delta spec terhadap existing spec di openspec/specs -->

## Impact

- **UI / Frontend**:
  - `src/components/catalog/BookPriceFields.tsx`: Menghapus input "Harga Dasar", menyisakan "Harga Beli" dan "Harga Jual".
  - `src/views/CatalogView.tsx`: Form tambah/edit buku mengoperasikan `buyPrice` & `sellPrice`, serta otomatis menyetel `price` = `sellPrice || buyPrice`.
  - `src/views/ProcurementView.tsx`: `handleUpdatePOItem` memperbarui `unitPrice` saat `bookId` berubah; input `unitPrice` diubah menjadi `readOnly`.
- **Database / Backend**:
  - Tidak ada perubahan skema database tabel atau migrasi D1 baru, karena kolom `price`, `buy_price`, dan `sell_price` sudah ada.
  - Kompatibilitas validasi API tetap terjaga.
- **Testing**:
  - Memastikan unit & integration test yang berkaitan dengan katalog dan PO tetap lulus.
