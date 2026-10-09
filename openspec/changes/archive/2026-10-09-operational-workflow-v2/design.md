## Context

Lihat `proposal.md` untuk latar belakang dan motivasi bisnis.
Codebase menggunakan Cloudflare Workers (Hono runtime), Drizzle ORM dengan database Cloudflare D1 (SQLite), dan frontend React/Vite.

Batasan Arsitektur Penting:
1. Cloudflare Workers beroperasi dalam V8 Isolate stateless tanpa persistent TCP sockets atau filesystem writable jangka panjang; tidak bisa menjalankan socket engine WhatsApp (Baileys/Puppeteer) langsung di dalam worker code.
2. Batasan bound parameter Cloudflare D1 (maksimal 10 baris insert per statement) mewajibkan eksekusi chunking sekuensial.
3. Transaksi multi-tulis wajib atomik atau idempoten untuk mencegah diskrepansi stok dan status pemenuhan order.

## Goals / Non-Goals

**Goals:**
- Menyediakan arsitektur pengadaan hierarkis: Cabang PO Paket ke Pusat, Pusat merakit paket dan mengirim via multi Surat Jalan ke Cabang.
- Mengakomodasi perakitan paket berstatus parsial dan pencatatan outstanding book items saat pengiriman bertahap.
- Membuka fleksibilitas pembayaran dan serah terima buku melalui modul Diskresi Finance multi-aksi (potong harga, gratis 100%, dispensasi izin ambil).
- Mengintegrasikan pencatatan surat jalan supplier dan penerimaan parsial pada PO pengadaan.
- Menyediakan endpoint integrasi WhatsApp via HTTP REST abstraction yang aman untuk Cloudflare Workers.
- Memfasilitasi bulk upload data siswa via format standar (Excel/CSV) dengan strategi upsert.
- Mengakomodasi alur refund orang tua di Gudang Pusat dan retur supplier (RTV).

**Non-Goals:**
- Membangun in-process WhatsApp TCP socket engine di dalam Cloudflare Workers (solusi menggunakan sidecar gateway via REST).
- Otomasi pembayaran payment gateway (Midtrans/Xendit) otomatis saat ini (fokus pada pencatatan manual kasir/finance).

## Decisions

### 1. WhatsApp Bridge: HTTP REST Client to Independent Sidecar
- **Keputusan**: Backend workers menyediakan `WhatsAppNotificationService` yang memanggil HTTP API endpoint (misal `POST /api/send-message` dengan payload `{ phone, message }`). Konfigurasi disimpan dalam database settings (`WA_GATEWAY_URL`, `WA_API_KEY`).
- **Alternatif**:
  - *Baileys langsung di Workers*: Ditolak karena Workers tidak mendukung TCP raw socket yang persisten dan state file credential.
  - *Meta Cloud API resmi*: Ditolak karena pengguna ingin memakai nomor HP pribadi tanpa verifikasi bisnis Facebook yang rumit.

### 2. Multi-Surat Jalan & Outstanding Backorder Tracking
- **Keputusan**: Menambahkan tabel `delivery_receipts` untuk PO supplier dan `branch_shipments` untuk PO internal cabang. Satu PO memiliki relasi 1-to-many ke Surat Jalan. Status PO dihitung dinamis:
  - `received_qty < ordered_qty` -> `PARTIAL`
  - `received_qty >= ordered_qty` -> `COMPLETED`
  - Buku yang belum terkirim otomatis dihitung sebagai `outstanding_qty = ordered_qty - fulfilled_qty`.
- **Alternatif**:
  - *Membuat PO baru untuk sisa buku*: Ditolak karena membebani admin cabang dan membuat pembukuan ganda.

### 3. Paket Parsial (Incomplete Kit Assembly)
- **Keputusan**: Paket buku (`package_items`) mendukung status kelengkapan `completeness_status`: `'COMPLETE'` vs `'INCOMPLETE'`. Bila ada judul yang belum datang dari supplier, paket tetap dapat dirakit dengan komponen yang tersedia. Buku yang kurang dicatat sebagai baris `outstanding_package_items`.
- **Alternatif**:
  - *Membuat tipe paket baru*: Ditolak karena mengubah skema katalog dan kurikulum.

### 4. Diskresi Finance pada Model Pemesanan Siswa
- **Keputusan**: Pada tabel `student_book_orders`, ditambahkan kolom:
  - `finance_handover_approved` (boolean, default false)
  - `discount_amount` (integer rupiah)
  - `discretion_type` (`'NONE' | 'DISCOUNT' | 'SCHOLARSHIP' | 'HANDOVER_OVERRIDE'`)
  - `discretion_notes` (text)
  - `discretion_by_user_id` (text)
  Validasi serah terima diizinkan jika `(payment_status === 'PAID') OR (finance_handover_approved === true)`.

### 5. Impor Siswa Massal dengan Strategi Upsert
- **Keputusan**: Impor membaca file CSV/Excel di browser atau backend, kemudian menjalankan `INSERT INTO students (...) ON CONFLICT (school_id, nis) DO UPDATE SET ...` yang dipecah dalam chunk maksimal 10 baris per eksekusi D1.

## Risks / Trade-offs

- **[Risk]** WhatsApp sidecar down atau nomor admin terputus/logout dari HP.
  - *Mitigasi*: Pengiriman notifikasi dibuat non-blocking (asynchronous background try-catch). Kegagalan kirim WA tidak boleh menggagalkan transaksi DB utama (fail-open dengan log audit).
- **[Risk]** Diskrepansi stok saat paket parsial dilunasi dengan pengiriman susulan.
  - *Mitigasi*: Validasi atomik saat Surat Jalan kedua diterbitkan agar hanya memotong stok buku yang benar-benar berstatus outstanding pada PO terkait.
- **[Risk]** Batas performa upload Excel berukuran ribuan baris di worker.
  - *Mitigasi*: Parsing file dilakukan di sisi client/browser, mengirimkan data terstruktur dalam payload batch kecil (misal per 50-100 baris) ke backend.
