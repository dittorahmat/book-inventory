# Design: simplify-book-prices-and-po-sync

## Context

Sistem inventaris buku memiliki skema data buku yang mencatat `price` (kolom legacy), `buy_price`, dan `sell_price`. Form katalog saat ini menampilkan ketiga field tersebut sehingga membingungkan pengguna.
Di sisi lain, pada formulir pembuatan Purchase Order (PO) di `ProcurementView.tsx`, fungsi `handleUpdatePOItem` saat ini hanya memperbarui `bookId` ketika dropdown judul buku diubah tanpa memperbarui `unitPrice`. Akibatnya, `unitPrice` tetap menggunakan harga buku sebelumnya dan mewajibkan pengguna mengetik harga secara manual.

Lihat `proposal.md` untuk motivasi dan latar belakang kebutuhan pengguna.

## Goals / Non-Goals

**Goals:**
- Menghapus input "Harga Dasar (Rp)" dari antarmuka `BookPriceFields.tsx` dan `CatalogView.tsx`.
- Menjaga integritas data dan kompatibilitas API backend tanpa perlu migrasi skema database baru: kolom `price` diisi otomatis sebagai `sellPrice || buyPrice || 0`.
- Memperbarui `handleUpdatePOItem` di `ProcurementView.tsx` agar saat `field === "bookId"`, nilai `unitPrice` otomatis diperbarui menjadi `defaultBuyPrice(newBookId, 0)`.
- Mengunci elemen input `unitPrice` pada tabel baris PO menjadi `readOnly` dengan styling abu-abu lembut / disabled visual agar pengguna tahu harga berasal dari master katalog.

**Non-Goals:**
- Mengubah skema tabel database SQLite / Cloudflare D1 (`books`, `purchase_orders`, `purchase_order_items`).
- Menghilangkan logika diskon persentase (`discountPercent`) pada item PO yang tetap dapat diisi oleh pengguna jika supplier memberikan diskon.
- Menghapus kolom `price` dari database.

## Decisions

### Decision 1: Penyesuaian Komponen BookPriceFields
- **Pilihan**: Ubah `BookPriceFields.tsx` agar hanya merender dua kolom: `Harga Beli (Rp)` dan `Harga Jual (Rp)`. Hapus input `Harga Dasar (Rp)`.
- **Handling Legacy Price**: Pada form create/edit di `CatalogView.tsx`, saat user mengubah `sellPrice` atau `buyPrice`, `price` secara otomatis disamakan dengan `sellPrice > 0 ? sellPrice : buyPrice` sebelum dikirim ke endpoint API (`POST /api/catalog/books` / `PATCH /api/catalog/books/:id`).
- **Alternatif**: Menghapus kolom `price` dari DB dan API. Ditolak karena berisiko memecah kontrak API Cloudflare Worker dan membutuhkan migrasi D1 yang tidak perlu.

### Decision 2: Sinkronisasi Otomatis & Read-Only pada PO Unit Price
- **Pilihan**:
  1. Pada fungsi `handleUpdatePOItem(index, field, val)` di `ProcurementView.tsx`:
     ```ts
     if (field === "bookId") {
       const newBuyPrice = defaultBuyPrice(val, 0);
       return { ...item, bookId: val, unitPrice: newBuyPrice };
     }
     ```
  2. Pada input harga satuan di JSX:
     Tambahkan atribut `readOnly` dan sesuaikan class styling Tailwind (misal `bg-[#F0F2F5] cursor-not-allowed border-[#E4E6EB] text-[#65676B] font-semibold text-right`).
- **Alternatif**: Tetap mengizinkan edit manual harga satuan dengan checkbox override. Ditolak karena preferensi spesifik user adalah mengunci secara pasti (read-only) untuk mencegah ketidakkonsistenan dengan katalog penerbit.

## Risks / Trade-offs

- **[Buku Tanpa Harga Beli di Katalog]** → Jika ada buku katalog yang harga belinya 0 / belum diisi, harga satuan di PO akan menjadi Rp 0.
  - *Mitigasi*: Validasi PO submit (`handleSubmitCreatePO`) memastikan atau memberi peringatan jika ada item dengan unit price 0 atau user diingatkan untuk melengkapi harga beli di katalog terlebih dahulu.
- **[Diskon Khusus dari Vendor]** → Karena harga satuan read-only, penyesuaian penawaran vendor dilakukan melalui field `discountPercent` yang tetap aktif dan editable.
