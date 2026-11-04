# Aturan Database & Cloudflare D1

Dokumen ini memuat aturan kanonik dan mandat anti-kambuh untuk skema database, disiplin penulisan batch Cloudflare D1, integritas relasional, serta pencegahan drift skema remote.

---

## Mandat Anti-Kambuh

### §0.10. Integritas Skema & Anti-String-Packing
Data terstruktur domain (seperti nomor WA manual, tautan dokumen finance) wajib dialokasikan di kolom skema resmi atau objek terstruktur, dilarang dipadatkan (packed) ke dalam string catatan bebas (`notes`) dengan tag parsing darurat (`[WA: ...]`). Ditegakkan mekanis oleh `check:string-packing`.

### §0.11. Disiplin Validasi Bukti Dokumen
Input bukti dokumen (seperti Surat Jalan atau surat rekomendasi) wajib menyediakan alur upload file (data-URL/blob/storage) dan penambahan validasi wajib tidak boleh merusak pemanggil lama tanpa migrasi lengkap di diff yang sama.

### §0.19. Disiplin Batching D1 pada Seeder
Seluruh penambahan data di seeder (`seed.ts` maupun `seed-demo/*.ts`) wajib mematuhi batas chunking D1 (maksimal 10 baris per statement `INSERT ... VALUES` via `chunkRows` atau `runWriteBatch`), dilarang melakukan perulangan insert satu per satu (`insert().values({ ... })` tunggal).

### §0.26. Integritas Penamaan Entitas & Anti-Residual Identifier
Saat melakukan perubahan identitas nama data demo/domain (seperti nama siswa, kode akun, atau nomor referensi), lakukan penyelarasan menyeluruh hingga ke ID slug seeded (`id`, `orderId`, `receiptId`) untuk mencegah bau kode leaky identifier / mismatch kognitif antara nama tampilan dan kunci relasi database. Ditegakkan mekanis oleh gate `check:seed-integrity`.

### §0.27. Disiplin Batch Updates Mutasi Masal D1
Seluruh operasi pembaruan masal multi-baris (seperti kenaikan kelas murid `batchPromoteStudents`, mutasi status katalog, atau pengalihan lokasi) wajib mengelompokkan ID target ke dalam chunk aman D1 (`chunkRows` dari `src/server/lib/d1-write.ts`) dan menggunakan predikat set `inArray(table.id, chunk)` atau `db.batch()`, dilarang mengeksekusi perulangan `database.update().where(eq(id))` satu per satu.

### §0.30. Disiplin Sinkronisasi Skema Remote D1 & Anti-Drift
Setiap penambahan atau modifikasi migrasi SQL di folder `drizzle/*.sql` wajib diverifikasi kelengkapannya ke remote Cloudflare D1 (`bun run check:d1-drift` dan `wrangler d1 execute book-inventory-db --remote`) sebelum menguji endpoint produksi atau membuat PR. Skrip `check:fast` secara otomatis memicu alarm drift bila ada berkas migrasi yang berubah, dan runner `bun run deploy` otomatis mengeksekusi gate `check:d1-drift` sebelum deploy worker. Dilarang membiarkan perbedaan kolom antara schema kode TypeScript dan SQLite remote.

### §0.34. Disiplin Whitelist Single-Writer Gate & Integritas Seeder
Pengecualian pada gate `check:single-writer` hanya diizinkan untuk baseline seeder utama (`src/server/seed.ts`) atau file seeder demo spesifik yang tercantum secara eksplisit (*exact whitelist*, misal `seed-demo/orders.ts`); dilarang menggunakan wildcard atau prefix glob/directory sweeping (`startsWith("src/server/seed-demo/")`) yang dapat melemahkan penegakan arsitektur single-writer secara tidak sengaja di seluruh seeder baru.

### §0.54. Disiplin Navigasi Skema Relasi & Factory Test Fixtures
1. **Pemisahan Scope Skema Global vs Cabang**: entitas katalog terpusat (`books`, `book_packages`, `uniform_variants`, `uniform_packages`) dilarang diasumsikan memiliki kolom `school_id`; konsultasikan `src/db/SCHEMA_OVERVIEW.md` sebelum merakit query atau fixtures baru.
2. **Penggunaan Factory Test Fixtures Kanonik**: penyusunan data awal pengujian (test fixtures) wajib memanfaatkan helper kanonik di `src/server/lib/test-fixtures.ts` (`createTestSchool`, `createTestStudent`, `createTestBookOrder`, `createTestPackage`, `createTestBook`) alih-alih merakit baris mentah `insert().values({...})` yang rentan terhadap kegagalan kolom `NOT NULL` SQLite.
3. **Kelengkapan Antarmuka Pengguna pada Fitur Intake**: penambahan alur intake atau percabangan submit baru di backend tidak boleh berhenti di layer API/state belaka; implementasi dinyatakan selesai (*Definition of Done*) hanya jika telah menyediakan komponen antarmuka pengguna visual (modal/dialog/form) yang teruji secara interaktif.

### §0.55. Disiplin Layanan Integrasi Cloud & In-Memory Stream (Cloudflare Workers)
1. **Seam Layanan Drive Tunggal**: pembacaan berkas atau resource Google Drive / Google Sheets (`/api/books/parse-drive-url` dan `/api/students/parse-drive-url`) wajib didelegasikan ke seam terpusat `drive-service.ts` (`src/server/services/drive-service.ts`), dilarang menduplikasi logika proxy parsing URL Google Drive/Sheets di handler router.
2. **Kompatibilitas Cloudflare Workers (No-Filesystem)**: integrasi pihak ketiga pada server backend wajib murni berbasis Web Standard API (`fetch`, `Response.text()`, `Response.arrayBuffer()`, memory stream) tanpa ketergantungan pada modul sistem operasi atau disk filesystem Node (`fs`, `tmp`, `curl`). Seluruh manipulasi berkas eksternal di runtime harus in-memory stream agar 100% kompatibel saat dideploy ke Cloudflare Workers (`worker.dev`).
3. **Penegakan Sinkronisasi Harga Paket Otomatis**: setiap import katalog buku yang mengaktifkan auto-bundling paket (`autoCreatePackages: true`) wajib mengeksekusi seam kanonik `recalcPackagePrice(database, packageId)` (§0.28) seketika BOM terbentuk agar total harga paket buku selalu tersinkronisasi all-in di database.
4. **Kanonikalisasi Penerbit Al-Wildan & Guard Batch Selesai**: inferensi cerdas katalog buku wajib memetakan varian Al-Wildan secara kanonik ke `"Al-Wildan Press"` (publisher consistency); batch folder runner (`DriveFolderBatchRunner`) dilarang memicu `onComplete()` jika seluruh berkas gagal atau menghasilkan 0 baris valid guna mencegah penyelesaian prematur modal intake.
5. **Seam Hook Koordinasi Drive Intake & Penegakan Mekanis Test-DOM**: koordinasi state dan pengambilan berkas Google Drive di modal frontend wajib memusat ke custom hook kanonik `useDriveFolderIntake` (`src/components/ui/useDriveFolderIntake.ts`), dilarang menduplikasi pasangan state `sheetsUrl`/`folderFiles`/`isParsingDrive` di masing-masing modal. Seluruh pengujian komponen antarmuka React (`*.test.tsx`) yang merender DOM wajib memakai shim `test-dom` dan dynamic import `@testing-library/react`, ditegakkan secara mekanis di pre-commit dan CI oleh gate `check:test-dom`.

---

## Disiplin Tulis Cloudflare D1 & Workers (Detail Teknis Eks-§10)

Latar dan bukti: `CODING_STANDARDS.md` §6. Aturan yang mengikat:

1. Satu statement `INSERT ... VALUES` maksimal **10 baris**, dieksekusi sekuensial (chunked).
2. `Promise.all` **dilarang** untuk operasi tulis; gunakan eksekusi sekuensial atau `db.batch()`.
3. Alur mutasi induk + anak wajib atomik (`db.batch()` di D1, fallback sekuensial di bun-sqlite) atau idempoten dengan validasi pra-tulis yang mengembalikan 400.
4. Constraint SQLite (`UNIQUE`/`FOREIGN KEY`) wajib dipetakan ke status HTTP 4xx lewat `d1WriteErrorStatus()` (`src/server/lib/d1-write.ts`); kegagalan infra (`D1_ERROR`) wajib dilempar ulang agar menjadi 500 + ref, bukan 400 palsu.
5. Endpoint tulis bervolume wajib diuji ≥30 baris sekaligus di `src/server/routes/*.test.ts`.
