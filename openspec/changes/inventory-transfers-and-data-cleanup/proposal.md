## Why

Feedback demo dan pengujian operasional pengguna mengidentifikasi beberapa friction point kritis:
1. Paket buku belum bisa dihapus; data demo kotor tidak dapat dibersihkan secara granular (belum ada tombol hapus per baris).
2. Pembongkaran paket menyebabkan pembengkakan kalkulasi stok total (misal format `0/20` berubah menjadi `20/40`) karena unit yang sebelumnya `disposed` dihitung bersamaan dengan unit baru hasil bongkar.
3. Dropdown kelas di formulir pemesanan siswa portal publik terbatas hanya pada kelas 1, 2, 7, dan 10, menghambat demo jenjang lain.
4. Serah terima buku kepada siswa (handover) tidak melakukan validasi ketersediaan stok fisik (fail-open), sehingga pesanan dapat diserahkan meskipun stok cabang 0.
5. Alur transfer antarcabang terlalu birokratis (harus simpan draf, buka kartu, klik dispatch, lalu buka kartu lagi untuk receive); tidak ada opsi transfer langsung (instant), tombol aksi tersembunyi di modal detail, dan daftar transfer tanpa pemisah status membuat layar menumpuk.

## What Changes

- **Delete Buku Paket dengan Otomatisasi Unbundle**: Menambahkan endpoint `DELETE /api/packages/:id` yang membongkar bundel siap serah (`in_stock`) kembali menjadi buku satuan sebelum menghapus definisi paket.
- **Pembersihan Data Granular**: Menyediakan aksi hapus per baris data di view utama (Paket, Siswa, Pesanan Siswa, Transfer).
- **Perbaikan Kalkulasi Stok Satuan (Bongkar Paket)**: Memperbaiki agregasi dan siklus hidup eksemplar agar unit `disposed` tidak dihitung sebagai bagian dari total fisik aktif, menjaga konsistensi stok `20/20`.
- **Dropdown Kelas Lengkap**: Melengkapi opsi kelas di `StudentSearchStep` dan form terkait mencakup jenjang Kelas 1 s.d. 12 (SD 1–6, SMP 7–9, SMA 10–12).
- **Validasi Stok Ketat (Fail-Closed) Serah Terima**: Memblokir serah terima murid jika stok paket atau satuan di cabang tujuan 0 dengan pesan peringatan eksplisit.
- **Penyederhanaan Transfer Stok & Opsi Instan**:
  - Menambahkan dukungan Instant Transfer (pindah stok langsung tanpa status transit).
  - Meletakkan tombol aksi Kirim dan Terima langsung pada kartu transfer di `TransfersView`.
  - Menambahkan filter pill status (`Semua`, `Draft`, `In Transit`, `Selesai`) di modul transfer.

## Capabilities

### New Capabilities
- `package-lifecycle-and-cleanup`: Pengelolaan siklus hidup paket buku (penghapusan paket dengan auto-unbundle, pembersihan data granular).
- `stock-integrity-and-handover`: Integritas penghitungan stok saat unbundle dan validasi ketersediaan stok fisik sebelum serah terima buku ke siswa.
- `streamlined-transfers`: Penyederhanaan alur mutasi transfer stok, transfer instan, aksi cepat di antarmuka, dan tab filter status transfer.

### Modified Capabilities
<!-- Tidak ada - openspec/specs saat ini belum memiliki spec dasar -->

## Impact

- **API & Backend**:
  - `src/server/routes/packages.ts`: Endpoint `DELETE /:id`.
  - `src/server/services/package-assembly.ts`: Logika pemulihan stok saat hapus paket & pencegahan duplikasi buku satuan.
  - `src/server/services/stock-kernel.ts` & `stock-summary.ts`: Koreksi filter bucket `totalQty`.
  - `src/server/services/order-fulfilment.ts`: Validasi stok fail-closed sebelum menyelesaikan handover.
  - `src/server/routes/shipments.ts` & `src/server/services/shipment-write.ts`: Dukungan parameter `instant` pada create shipment.
- **Frontend**:
  - `src/views/PackagesView.tsx`: Tombol hapus paket.
  - `src/components/portal/StudentSearchStep.tsx`: Pilihan kelas 1–12 lengkap.
  - `src/views/TransfersView.tsx`: Tab filter per status, tombol aksi cepat (dispatch/receive) langsung di kartu, dan toggle instant transfer.
