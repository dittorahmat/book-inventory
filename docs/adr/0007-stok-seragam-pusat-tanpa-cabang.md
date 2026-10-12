# Stok seragam hanya di gudang pusat, tanpa cabang

Stok seragam = kuantitas per (varian, ukuran) di gudang pusat (`uniform_stock`), tanpa barcode per potong. Cabang memegang nol stok seragam: tidak ada Internal PO, tidak ada Transfer Shipment untuk seragam. PO supplier (`uniform_pos`) boleh campur baris kain + olahraga ke satu supplier; penerimaannya menambah stok gudang. Filter "per sekolah" di laporan seragam = sekolah asal murid (pengelompokan administratif), bukan lokasi stok.

## Considered Options

- Barcode per potong seperti Book Item vs kuantitas per varian-ukuran (dipilih: kuantitas — volume besar × gender × jenjang × size, tukar-ukuran lazim; scanning per potong tanpa nilai untuk v1).
- Stok cabang + Internal PO seperti buku vs pusat saja (dipilih: pusat saja — request eksplisit semua PO langsung gudang → rumah murid, cabang tidak pegang stok).

## Consequences

Tidak ada mutasi fisik antar-sekolah untuk seragam; laporan tidak perlu join lokasi stok. Jika bisnis kelak butuh stok cabang, ajukan ADR baru beserta model Internal PO seragam.
