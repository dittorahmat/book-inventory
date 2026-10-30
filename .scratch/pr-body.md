## Ringkasan Perubahan

Mengimplementasikan alur pengiriman paket buku rutin / ad-hoc dari Gudang Pusat ke Cabang via Surat Jalan internal dan penerimaannya di cabang sesuai spesifikasi tiket #238, #239, #240, dan #241.

### 1. Penyelarasan Navigasi Tab & Judul Halaman (Closes #238)
- Label tab desktop `internal_orders` di [staff-tabs.ts](file:///d:/development/book-inventory/src/components/layout/staff-tabs.ts):
  - Gudang Logistik: **"Kirim Paket Ke Cabang"**
  - Staf Cabang: **"Terima Paket Dari Gudang"**
- Header dan subjudul di [InternalProcurementView.tsx](file:///d:/development/book-inventory/src/views/InternalProcurementView.tsx) dinamis menyesuaikan role aktif pengguna.

### 2. Form Pengiriman Rutin Via Surat Jalan Sebagai Default (Closes #239)
- Menata ulang tab pada [CreateInternalShipmentModal.tsx](file:///d:/development/book-inventory/src/components/internal-orders/CreateInternalShipmentModal.tsx) dengan:
  - Tab 1 (Default): **"Pengiriman Rutin Via Surat Jalan"** (menggantikan "Pengiriman Manual Bebas (Tanpa PO)") langsung membuka pilihan Cabang Tujuan, Nomor SJ, dan daftar item paket.
  - Tab 2: **"Penuhi PO Cabang Terutang"**.

### 3. Endpoint Incoming Shipments & Penerimaan di Cabang (Closes #240)
- Menambahkan endpoint `GET /api/internal-orders/shipments/incoming?schoolId=...` terisolasi berbasis lokasi di [internal-orders.ts](file:///d:/development/book-inventory/src/server/routes/internal-orders.ts) dan seam [shipment.ts](file:///d:/development/book-inventory/src/server/services/internal-po/shipment.ts).
- Halaman cabang menampilkan seksi kiriman **"Kiriman Surat Jalan dari Gudang"** jika terdapat surat jalan `in_transit` yang ditujukan ke cabang tersebut.
- Tombol **"Terima Barang"** memunculkan [ReceiveInternalShipmentModal.tsx](file:///d:/development/book-inventory/src/components/internal-orders/ReceiveInternalShipmentModal.tsx) untuk verifikasi checklist fisik barang dan memperbarui status menjadi `delivered`.

### 4. Pembakuan Istilah di Kamus Domain (Closes #241)
- Memasukkan istilah kanonik **Pengiriman Rutin Via Surat Jalan** di [GLOSSARY.md](file:///d:/development/book-inventory/GLOSSARY.md).

## Perubahan perilaku
- Role Gudang Logistik kini melihat tab "Kirim Paket Ke Cabang", dan saat membuka "Buat Surat Jalan", modal langsung berada di form "Pengiriman Rutin Via Surat Jalan".
- Role Cabang melihat tab "Terima Paket Dari Gudang", dan bila ada surat jalan rutin/ad-hoc yang sedang dikirim dari gudang, langsung muncul notifikasi dan kartu kiriman untuk dikonfirmasi terima.

## Bukti Pengujian
- Unit test navigasi: `bun test src/components/layout/staff-tabs.test.ts` (6 pass).
- API integration test: `bun test src/server/routes/internal-orders.test.ts` (10 pass).
- Gate pre-commit & `check:fast`: semua lulus hijau.
