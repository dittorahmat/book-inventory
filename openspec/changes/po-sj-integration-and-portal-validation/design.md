# Design

## Context
Sistem saat ini memiliki entitas `internal_purchase_orders` dan `internal_shipments` (Surat Jalan Internal), serta modul `student_book_orders` pada portal siswa. Namun:
- Pada portal siswa, input bukti transfer sebelumnya bersifat opsional dan delivery method paket belum dibatasi secara ketat di sisi klien maupun validasi API.
- Di sisi logistik pusat, antrean PO Cabang (`internal_purchase_orders`) belum terintegrasi secara seamless di UI Gudang Pusat, dan formulir pembuatan Surat Jalan (`internal_shipments`) belum memiliki dropdown pemilihan PO yang memuat saran item (suggestion) otomatis yang tetap editable, serta belum ada toggle pengiriman manual tanpa PO.
- Tabel `internal_shipments` saat ini mendefinisikan `internal_po_id TEXT NOT NULL`. Untuk mendukung pengiriman manual tanpa PO, kolom ini perlu disesuaikan agar nullable atau dibuatkan fallback/dummy ref, serta relasi ke cabang tujuan diperjelas.

## Goals / Non-Goals

**Goals:**
- Memblokir submit order siswa di frontend dan backend jika berkas bukti transfer tidak disertakan.
- Menyembunyikan/menonaktifkan opsi "Kirim ke Rumah" pada pesanan bertipe paket buku di portal.
- Menampilkan daftar PO Cabang aktif yang berstatus terutang di portal/dashboard Gudang Pusat.
- Mengimplementasikan formulir pembuatan Surat Jalan yang mendukung:
  1. Pemilihan PO Cabang terutang dengan auto-fill rincian item saran yang kuantitasnya dapat diedit.
  2. Mode pengiriman manual tanpa PO (dengan pemilihan sekolah cabang tujuan secara langsung).
- Menyediakan mekanisme konfirmasi penerimaan fisik oleh cabang yang memperbarui status Surat Jalan dan PO terkait.

**Non-Goals:**
- Mengubah alur verifikasi keuangan/finance secara menyeluruh (bukti transfer tetap dapat divalidasi kemudian oleh admin keuangan).
- Mengubah integrasi vendor supplier eksternal (`purchase_orders` ke percetakan luar).

## Decisions

### 1. Schema Penyesuaian `internal_shipments` untuk Mode Manual
- **Pilihan**: Mengubah kolom `internal_po_id` pada `internal_shipments` agar nullable (`TEXT NULL`) dan menambahkan `destination_school_id TEXT NOT NULL` (atau mengambil dari relasi PO jika terisi).
- **Rasional**: Pengiriman manual tidak memiliki `internal_po_id`, tetapi tetap wajib memiliki `destination_school_id` yang jelas agar buku dapat dimutasikan ke inventaris cabang yang tepat.
- **Alternatif**: Menggunakan PO virtual/dummy untuk pengiriman manual. (Ditolak: Menimbulkan data sampah di tabel `internal_purchase_orders`).

### 2. Validasi Bukti Transfer di Portal Siswa
- **Pilihan**: Validasi ganda (Klien & Server).
  - Di frontend: Form submission dinonaktifkan (`disabled`) dan menampilkan peringatan jika state upload bukti transfer kosong.
  - Di backend (`order-intake`): Validasi schema menolak payload yang tidak menyertakan bukti pembayaran (misal `paymentReceiptUrl` atau token berkas).
- **Rasional**: Mencegah bypass lewat request langsung atau state race condition.

### 3. Editable Suggestion pada Rincian Item Surat Jalan
- **Pilihan**: Ketika staf gudang memilih PO di dropdown, frontend memanggil endpoint `/api/internal-po/:id/outstanding-items` dan mengisikannya ke dalam form item Surat Jalan sebagai state awal. Staf bebas mengubah angka `quantity` atau menghapus baris item yang belum siap dikirim.
- **Rasional**: Memberikan fleksibilitas penuh bagi gudang pusat saat stok riil di rak gudang belum lengkap untuk seluruh paket/buku.

### 4. Pelacakan Status PO Cabang
- **Pilihan**: Sistem menghitung total item yang dipesan vs total item yang sudah dikonfirmasi diterima via seluruh Surat Jalan terkait PO tersebut:
  - Belum ada kiriman: `pending` / `submitted`
  - Sebagian terkirim / diterima: `partially_delivered`
  - Seluruh item terpenuhi: `completed`
- **Rasional**: Idempoten dan konsisten mendukung multi Surat Jalan tanpa redundansi data.

## Risks / Trade-offs

- **[Risk] Migrasi Kolom DB D1**: Mengubah `internal_po_id` menjadi nullable pada SQLite/D1 memerlukan penanganan migrasi yang aman.
  - *Mitigasi*: Buat migrasi Drizzle yang kompatibel dengan SQLite (`bun run db:generate`), dan terapkan sesuai protokol ADR-0013.
- **[Risk] Validasi Bukti Transfer Memblokir Alur Khusus**: Siswa beasiswa mungkin tidak memiliki slip transfer bank.
  - *Mitigasi*: Siswa kategori beasiswa (discretion scholarship) memiliki alur unggah bukti beasiswa tersendiri (`scholarship_proof_url`) yang berlaku sebagai bukti validasi pengganti transfer bank.
