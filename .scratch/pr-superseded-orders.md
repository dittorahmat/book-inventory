## Ringkasan Perubahan

Mengimplementasikan penanganan otomatis untuk pesanan gantung murid (buku maupun seragam) yang digantikan / tertimpa akibat revisi kurikulum, perubahan paket, atau penyesuaian ukuran seragam sebelum barang dikirim/diserahterimakan (**ADR-0021**).

### 1. Skema & Mutasi Stok Fisik (Ticket 01)
- Menambahkan status `superseded` pada enum `fulfillmentStatus` pesanan buku dan `shipmentStatus` pesanan seragam.
- Menambahkan kolom `superseded_by_order_id` pada tabel `student_book_orders` dan `uniform_orders`.
- Menyediakan seam kanonik pelepasan alokasi fisik (`supersedeBookOrder` & `supersedeUniformOrder` di `src/server/services/order-supersede.ts`):
  - Paket buku: mengubah status fisik `assigned_to_order` menjadi `in_stock`.
  - Seragam: mengembalikan stok varian via `adjustVariantStockQuery`.

### 2. Realokasi Pembayaran & Beasiswa via Ledger (Ticket 02)
- Menyediakan orchestrator finansial kanonik `handleOrderReplacement` di `src/server/services/order-reallocation.ts`.
- Mengalihkan baris alokasi dana `payment_allocations` ke `orderId` baru melalui helper kanonik single-writer `reallocateAllocationQuery` di `payment-ledger.ts`.
- Menerbitkan slip refund pending (`refund_slips`) berbasis `RET-B-*` / `RET-U-*` bila terdapat kelebihan bayar.
- Meneruskan status beasiswa (`scholarship_pending` / `scholarship_approved`) beserta dokumen bukti ke pesanan baru secara otomatis.

### 3. Alur Intake Portal Publik & Dialog Konfirmasi (Ticket 03)
- Menambahkan endpoint `GET /api/public/orders/check-pending/:studentId` untuk deteksi pesanan gantung sebelum submit.
- Membuat dialog konfirmasi interaktif `PendingOrderConfirmModal` di wizard intake buku dan seragam dengan opsi:
  - **Ganti Pesanan Lama**: menandai order lama `superseded`, unassign stok fisik, dan mengalihkan dana pembayaran.
  - **Buat Pesanan Baru**: membuat pesanan tambahan secara terpisah.
- Validasi fail-closed: bila penggantian gagal, router langsung membalas status error HTTP eksplisit (400/404/409).

### 4. Visualisasi Riwayat Portal & Audit View Staf (Ticket 04)
- Menampilkan badge `TERTIMPA (SUPERSEDED)` dan nomor referensi pengganti pada tabel pesanan buku (`StudentOrdersTable.tsx`) dan seragam (`UniformShipmentSection.tsx`).
- Menambahkan filter `superseded` pada dropdown status pesanan buku dan seragam staf.
- Menampilkan keterangan `superseded` pada alur lookup pencarian refund portal murid.
- Menambahkan integration test E2E menyeluruh (`src/server/e2e-order-supersede.test.ts`).

### 5. Retrospektif & Mandat Anti-Kambuh
- Menambahkan `src/db/SCHEMA_OVERVIEW.md` untuk memetakan scope tabel global vs cabang.
- Menambahkan factory helper test fixtures (`createTestPackage`, `createTestBook`) di `test-fixtures.ts`.
- Menambahkan **Mandat §0.53 & §0.54** di `AGENTS.md`.

---

## Verifikasi Kualitas
- `bun run check:all`: 100% HIJAU (669 tests pass, 12 skip, 0 fail; Vite production build sukses; seluruh gate arsitektur lulus).
