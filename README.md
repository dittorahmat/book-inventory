# School Book Inventory & Logistics System

Sistem inventaris buku dan manajemen logistik distribusi fisik untuk sekolah cabang utama (HQ/Central Warehouse) ke sekolah anak cabang (Branch Schools).

Aplikasi ini dirancang dengan **arsitektur runtime-agnostik**, memungkinkan deployment awal di **Cloudflare Workers (D1 + R2)** dan transisi mulus ke **VPS / On-Premise (Bun Native SQLite + S3/MinIO/Local)** tanpa perubahan kode bisnis.

---

## 🚀 Fitur Utama

1. **Pelacakan Fisik Buku per Eksemplar (`book_items`)**:
   - Setiap buku fisik memiliki **Barcode / Asset Tag unik**.
   - Pelacakan kondisi fisik (`new`, `good`, `fair`, `damaged`).
   - Pelacakan status pergerakan (`in_stock`, `in_transit`, `disposed`, `lost`).
   - Filter cepat berdasarkan kondisi fisik (`All`, `New`, `Good`, `Fair`, `Damaged`) di Branch Inventory.
2. **Katalog Buku & Manajemen Cover**:
   - Master data katalog buku (ISBN, Judul, Pengarang, Penerbit).
   - **Search Bar instan**: Pencarian cepat judul, ISBN, pengarang, dan penerbit.
   - **Upload & Preview Cover Langsung**: Upload gambar cover buku langsung di formulir tambah judul baru (*Add Title*) maupun update via tabel dengan live preview.
   - Penyimpanan gambar cover terintegrasi (Cloudflare R2 atau S3-compatible storage).
3. **Logistik Distribusi Antar Sekolah (`transfer_shipments`)**:
   - Pembuatan surat jalan pengiriman (*draft*) dilengkapi field **Alasan/Kategori Transfer** (`reason`, misal: "Retur buku rusak", "Distribusi buku baru").
   - **Flag Kondisi Fisik Item**: Menampilkan indikator kondisi fisik asli buku saat dikirim dan verifikasi kondisi fisik saat diterima di cabang.
   - Pengiriman (*dispatch*) yang secara otomatis mengunci status buku menjadi `in_transit`.
   - Penerimaan barang di cabang (*receive*) dengan verifikasi barcode fisik serta pelaporan *discrepancy* (jika barang rusak/hilang di jalan).
4. **Quick Transfer & Sortir Retur di Branch Inventory**:
   - Staf cabang dapat menyaring buku rusak (`damaged`) dengan filter kondisi.
   - **Multi-select Checkbox**: Pilih satu atau banyak buku sekaligus.
   - **Quick Transfer Modal**: Tombol langsung untuk membuat draf mutasi/retur ke Kantor Pusat (HQ) atau cabang lain tanpa perlu input barcode manual.
5. **Isolasi Konteks Cabang**:
   - Admin cabang hanya mengelola dan melihat stok yang berada di sekolahnya (`current_school_id = branch_id`).

---

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh/) (Server, Tests, Script runner).
- **Backend**: [Hono](https://hono.dev/) TypeScript.
- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/).
- **Database & ORM**: [Drizzle ORM](https://orm.drizzle.team/) SQLite Core (`drizzle-orm/sqlite-core`).
- **Storage**: Cloudflare R2 / S3 Storage Abstraction.

---

## 🌐 Arsitektur Lingkungan Runtime (Agnostik)

Aplikasi secara otomatis mendeteksi lingkungan tempat ia dijalankan:

| Komponen | Cloudflare Workers (Fase 1) | VPS / On-Premise (Fase 2) |
|---|---|---|
| **Runtime** | Cloudflare Workers | Bun Native Runtime |
| **Database** | Cloudflare D1 (`env.DB`) | Bun Native SQLite (`bun:sqlite`) |
| **Cover Storage** | Cloudflare R2 (`env.BUCKET`) | S3 / MinIO / Memory Storage |
| **Static Assets** | Cloudflare Assets (`env.ASSETS`) | Bun static file serve / Nginx |

---

## 📦 Menjalankan Proyek secara Lokal (Bun)

### 1. Instalasi Dependencies
```bash
bun install
```

### 2. Sinkronisasi Database SQLite
```bash
bun run db:push
```

### 3. Menjalankan Backend Server (Hono)
```bash
bun run dev:server
# Server berjalan di http://localhost:3000
```

### 4. Menjalankan Frontend Dev Server (Vite)
```bash
bun run dev
# Frontend berjalan di http://localhost:5173
```

---

## ☁️ Deployment ke Cloudflare Workers

File konfigurasi Cloudflare Worker telah tersedia di [`wrangler.toml`](file:///D:/development/book-inventory/wrangler.toml) dan entry point di [`src/server/worker.ts`](file:///D:/development/book-inventory/src/server/worker.ts).

1. **Build Frontend terlebih dahulu:**
   ```bash
   bun run build
   ```

2. **Deploy via Wrangler:**
   ```bash
   bunx wrangler deploy
   ```

---

## 🧪 Testing & Quality Verification

Sebelum melakukan commit atau perubahan fitur, pastikan seluruh checklist di [`AGENTS.md`](file:///D:/development/book-inventory/AGENTS.md) terpenuhi:

```bash
# 1. Database schema sync
bun run db:push

# 2. Type-checking
bun run type-check

# 3. Linting
bun run lint

# 4. Production build check
bun run build

# 5. Test suite
bun run test
```

---

## 📖 Buku Panduan Pengguna (User Manual)

Dokumen panduan operasional lengkap untuk staf perpustakaan dan admin cabang tersedia dalam format PDF:
- 📄 **[Buku Panduan Pengguna (USER_MANUAL.pdf)](file:///D:/development/book-inventory/docs/USER_MANUAL.pdf)**
- 📝 Sumber Markdown: [`docs/USER_MANUAL.md`](file:///D:/development/book-inventory/docs/USER_MANUAL.md)

Panduan mencakup tata cara pendaftaran judul katalog dan upload cover, pencetakan barcode fisik, filter dan sortir stok rusak, pembuatan mutasi retur massal, hingga verifikasi penerimaan barang antar cabang.

