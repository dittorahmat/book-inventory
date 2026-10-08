## Context

Implementasi saat ini memiliki alur mutasi dan pengelolaan stok yang tersebar di beberapa service (`package-assembly.ts`, `stock-kernel.ts`, `order-fulfilment.ts`, `shipment-write.ts`). Sesuai aturan arsitektur (AGENTS.md):
- Batasan penulisan Cloudflare D1: operasi multi-row insert dilarang melebihi 10 baris per statement dan tidak boleh `Promise.all` untuk write (§10).
- Batas ukuran file 400 baris (§7) tetap dipatuhi saat menambahkan sub-komponen UI atau helper service.

## Goals / Non-Goals

**Goals:**
- Menyediakan endpoint `DELETE /api/packages/:id` yang aman dan otomatis membongkar paket fisik yang belum terdistribusi sebelum menghapus master paket.
- Mengoreksi kalkulasi `totalQty` di `stock-kernel.ts` agar status `disposed` diabaikan dari total fisik aktif, atau menghapus/reaktivasi eksemplar saat unbundle sehingga rasio kembali normal.
- Mengamankan serah terima pesanan murid (`order-fulfilment.ts`) dengan validasi stok fail-closed (menolak 400 jika bundel habis).
- Menyederhanakan transfer antarcabang dengan opsi transfer instan dan aksi langsung pada UI kartu transfer.
- Menambahkan tab filter status transfer di `TransfersView.tsx`.
- Melengkapi dropdown pilihan jenjang kelas di portal publik (Kelas 1–12).

**Non-Goals:**
- Mengubah skema database inti (`schema.ts`) secara radikal; kolom dan tabel yang ada sudah mencukupi untuk kebutuhan status dan relasi.
- Menghapus riwayat transaksi transfer yang sudah `completed`.

## Decisions

### 1. Auto-Unbundle pada Delete Package
- **Keputusan**: Saat `DELETE /api/packages/:id` dipanggil:
  1. Cari semua `package_items` berstatus `in_stock` untuk `packageId` tersebut.
  2. Kelompokkan per `currentSchoolId`, lalu panggil `disassemblePackageBundles` untuk masing-masing sekolah agar komponen BOM dikembalikan ke stok satuan `in_stock`.
  3. Hapus relasi `book_package_items`.
  4. Hapus baris `book_packages`.
- **Alternatif yang ditolak**: Hard delete tanpa unbundle (akan menyebabkan buku-buku fisik yang sudah dirakit hilang dari pencatatan inventaris).

### 2. Koreksi Perhitungan Total Stok Satuan (0/20 -> 20/40)
- **Keputusan**: Di `stock-kernel.ts` (`addLoose`), `tally.totalQty` hanya di-increment jika `row.status !== "disposed"` (hanya menghitung unit yang ada di gudang, transit, atau tercatat hilang/rusak aktif). Unit yang sudah diserap ke paket tidak boleh dihitung sebagai eksemplar satuan aktif.
- **Alternatif yang ditolak**: Menghapus baris `book_items` saat rakit (akan menghilangkan audit trail eksemplar lama).

### 3. Fail-Closed Order Handover
- **Keputusan**: Pada `handoverPackage` di `order-fulfilment.ts`, jika pesanan memiliki `packageId` namun tidak ditemukan `availableBundle` (`status === 'in_stock'` di sekolah yang sama), fungsi mengembalikan `{ ok: false, status: 400, message: "Stok paket tidak tersedia di cabang ini untuk diserahkan." }`.
- **Alternatif yang ditolak**: Mengizinkan serah terima tanpa alokasi bundel fisik (menyebabkan selisih stok antara pesanan dan gudang).

### 4. Instant Transfer dan Filter di TransfersView
- **Keputusan**:
  - Pada `createShipment`, tambahkan opsi `instant?: boolean`. Jika `true`, setelah pemotongan stok asal, barang langsung di-update `currentSchoolId = toSchoolId` dan status pengiriman diset `completed`.
  - Pada antarmuka `TransfersView.tsx`, tambahkan state `statusFilter: 'all' | 'draft' | 'in_transit' | 'completed'` dengan pill button, serta render tombol aksi `Dispatch` dan `Receive` langsung di kartu shipment.

## Risks / Trade-offs

- [Risk: Paket yang sudah terikat pada pesanan siswa yang belum diambil] → Mitigasi: Validasi saat delete paket, jika ada `package_items` yang berstatus selain `in_stock` (misal `delivered` atau `dispatched`), pastikan unbundle hanya menyentuh yang `in_stock`, dan beri catatan jika ada referensi historis.
- [Risk: Lonjakan baris unbundle massal di D1] → Mitigasi: Selalu gunakan batch chunking (§10 D1 Write Discipline) di `package-assembly.ts`.
