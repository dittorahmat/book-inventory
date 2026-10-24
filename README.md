# School Book Inventory & Logistics System

Sistem inventaris buku, manajemen paket kurikulum, pemesanan siswa/orang tua, dan logistik distribusi fisik untuk sekolah pusat (HQ/Central Warehouse) dan kampus cabang (Al Wildan Islamic School).

Aplikasi ini dirancang dengan **arsitektur runtime-agnostik**, memungkinkan deployment awal di **Cloudflare Workers (D1 + R2)** dan transisi mulus ke **VPS / On-Premise (Bun Native SQLite + S3/MinIO/Local)** tanpa perubahan kode bisnis.

---

## 🚀 Fitur Utama & Modul Operasional

### 1. Portal Publik Orang Tua & Siswa (Tanpa Perlu Login)
- **Deteksi Otomatis Kenaikan Kelas**: Cari data siswa via potongan nama (misal: "Hendra" / "Wahyudi") atau NIS. Sistem langsung mendeteksi status naik kelas dan merekomendasikan paket buku tingkatan kelas berikutnya.
- **Pendaftaran Murid Baru Mandiri**: Jika data siswa belum terdaftar, orang tua dapat langsung mengisi formulir pendaftaran murid baru.
- **Opsi Pembayaran Cicilan (Parsial)**: Dukungan alokasi nominal khusus buku untuk orang tua yang mentransfer biaya gabungan (misal SPP + Uang Buku dalam 1 bukti transfer).
- **Jalur Beasiswa (Diskon 100%)**: Fasilitas bebas biaya 100% untuk siswa beasiswa dengan melampirkan foto dokumen surat tanda beasiswa.
- **Layanan Pengaduan & Retur Buku Cacat**: Orang tua yang telah menerima buku dapat melaporkan komplain buku cacat produksi (halaman sobek, cetakan buram) dengan bukti foto langsung dari portal publik.

### 2. Modul Staf Logistik & Administrasi Sekolah
- **Pemisahan Hak Akses**:
  - **HQ Central Admin**: Mengelola seluruh unit sekolah, master paket buku, persetujuan beasiswa, pengadaan PO supplier, dan konfigurasi server SMTP.
  - **Branch Admin**: Terisolasi hanya mengelola stok dan siswa di unit kampusnya masing-masing.
- **Stok Berlapis: Satuan vs. Paket Bundling**:
  - Tracking fisik buku lepasan (*loose stock*) dan paket bundel siap serah (*ready assembled bundles*).
  - **Rakit Bundling (Assembly)**: Menggabungkan buku-buku satuan menjadi paket lengkap dengan kalkulasi potensi stok instan.
  - **Bongkar Bundling (Unbundle)**: Mengurai kembali paket buku menjadi stok satuan jika ada kebutuhan penggantian buku cacat di perpustakaan.
- **Penyerahan Buku & Nomor Surat Jalan Resmi**:
  - Penyerahan paket buku kepada siswa/wali murid secara otomatis menerbitkan **Nomor Surat Jalan Penyerahan** (`SJ-SERAH-xxxxxx`) dan mencatat tanggal/waktu serah terima.
- **Approval & Pertukaran Buku Cacat (Defect Returns)**:
  - Staf logistik meninjau foto bukti kerusakan yang dikirimkan orang tua dan dapat langsung menukar buku rusak dengan buku baru berkondisi *new* dari stok satuan gudang.
- **Pengadaan Purchase Order (PO) ke Supplier / Penerbit**:
  - Pengadaan buku dari distributor resmi (seperti Cambridge / Erlangga) dengan pencatatan penerimaan bertahap (*partially received*) yang langsung menambah stok gudang.
- **Transfer Antar Sekolah**:
  - Pembuatan draf mutasi antar cabang dari layar Stok Satuan; penguncian status `in_transit` dan penerimaan dengan pencatatan *discrepancy* tersedia lewat API (layar dispatch/receive belum ada).
- **Pengaturan Notifikasi Email & SMTP**:
  - Konfigurasi server SMTP internal untuk pengiriman notifikasi status pesanan kepada orang tua secara otomatis.

---

## 👥 Akun Demo & Akses Cepat

Tersedia akun demonstrasi lengkap dengan data realistis di 4 kampus Al Wildan:

| Peran (Role) | Email | Password | Unit / Kampus |
|---|---|---|---|
| **Central Admin (Gudang)** | `admin.gudang@alwildan.sch.id` | `password123` | Gudang Logistik (semua lokasi) |
| **Admin Logistik** | `admin.logistik@alwildan.sch.id` | `password123` | Gudang Logistik (buku + seragam) |
| **Admin Gudang Buku** | `admin.buku@alwildan.sch.id` | `password123` | Gudang Logistik |
| **Admin Gudang Seragam** | `admin.seragam@alwildan.sch.id` | `password123` | Gudang Logistik |
| **School Admin 1** | `admin.pusat@alwildan.sch.id` | `password123` | Al Wildan 1 |
| **Branch Admin 2** | `admin.cabang2@alwildan.sch.id` | `password123` | Al Wildan 2 |
| **Branch Admin 3** | `admin.cabang3@alwildan.sch.id` | `password123` | Al Wildan 3 |
| **Branch Admin 4** | `admin.cabang4@alwildan.sch.id` | `password123` | Al Wildan 4 |

📖 **Studi Kasus Demo End-to-End**: [**`docs/DEMO_SCENARIO.md`**](docs/DEMO_SCENARIO.md) berisi 20 skenario yang menutup seluruh modul: portal buku + satuan/WPR + beasiswa, pembayaran & invoice `/bayar/:token`, serah-terima, refund buku, katalog/paket/rakit, stok & penjualan langsung, PO supplier, IPO + surat jalan + push distribution, seragam, rekonsiliasi finansial, audit periode, laporan, dashboard, dan isolasi peran.

---

## 🛠️ Tech Stack

- **Runtime & Package Manager**: [Bun](https://bun.sh/) (Server, Testing, Scripts).
- **Backend**: [Hono](https://hono.dev/) TypeScript.
- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/).
- **Database & ORM**: [Drizzle ORM](https://orm.drizzle.team/) dengan SQLite Core.
  - Deployment Cloudflare: Cloudflare D1.
  - Deployment VPS/Lokal: Bun Native SQLite.
- **Storage**: Cloudflare R2 / S3 Storage Abstraction.

---

## 🌐 Arsitektur Lingkungan Runtime (Agnostik)

Aplikasi mendeteksi runtime secara dinamis:

| Komponen | Cloudflare Workers (Edge) | VPS / On-Premise (Standalone) |
|---|---|---|
| **Runtime** | Cloudflare Workers | Bun Native Runtime |
| **Database** | Cloudflare D1 (`env.DB`) | Bun Native SQLite (`bun:sqlite`) |
| **Cover & Media Storage** | Cloudflare R2 (`env.BUCKET`) | S3 / MinIO / Memory Storage |
| **Static Assets** | Cloudflare Assets (`env.ASSETS`) | Bun static file serve / Nginx |

---

## 📦 Menjalankan Proyek secara Lokal (Bun)

### 1. Instalasi Dependencies
```bash
bun install
```

### 2. Sinkronisasi Database SQLite Lokal
```bash
bun run db:push
```

### 3. Menjalankan Backend API (Hono)
```bash
bun run dev:server
# Server berjalan di http://localhost:3000
```

### 4. Menjalankan Frontend (Vite)
```bash
bun run dev
# Frontend berjalan di http://localhost:5173
```

---

## ☁️ Deployment ke Cloudflare Workers & D1

1. **Sinkronisasi Database Remote Cloudflare D1**:
   ```bash
   # Jalankan migrasi schema tabel ke remote D1:
   bun run db:d1:migrate
   
   # Eksekusi seed data demo ke remote D1:
   bun x wrangler d1 execute book-inventory-db --remote --file=./drizzle/seed-d1.sql
   ```

2. **Build Frontend & Assets**:
   ```bash
   bun run build
   ```

3. **Deploy Worker ke Cloudflare**:
   ```bash
   bun x wrangler deploy
   ```

---

## 🧪 Testing & Quality Verification

Pastikan checklist kualitas selalu dijalankan sebelum commit:

```bash
# 1. Type-checking (Zero error)
npm run type-check

# 2. Linting
npm run lint

# 3. Production build verification
npm run build

# 4. Unit & Integration test suite
npm run test
```

---

## 📖 Dokumentasi Terkait

- 🎯 **[Studi Kasus Demo End-to-End (docs/DEMO_SCENARIO.md)](docs/DEMO_SCENARIO.md)**: 20 skenario operasional — portal buku/satuan/WPR/beasiswa, pembayaran & invoice, serah-terima, refund, katalog & rakit, stok & transfer, PO supplier, IPO/push distribution, seragam, rekonsiliasi, audit periode, laporan, pengaturan, dan isolasi peran.
- 📄 **[Buku Panduan Pengguna (docs/USER_MANUAL.pdf)](file:///D:/development/book-inventory/docs/USER_MANUAL.pdf)**: Dokumentasi operasional manual format PDF untuk staf sekolah.
