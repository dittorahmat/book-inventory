## 1. Fondasi transport email

- [x] 1.1 Tambah `nodemailer` + `@types/nodemailer` ke `package.json` dan verifikasi `bun install` sukses tanpa error
- [x] 1.2 Pecah `src/server/services/email.ts` menjadi interface provider + `BrevoHttpProvider` (fetch) + `SmtpProvider` (dynamic import nodemailer) + factory `auto`, dan verifikasi `npm run type-check` lolos tanpa error
- [x] 1.3 Teruskan `env` (Workers `c.env` / `process.env`) ke `getSmtpConfig`/`sendEmailNotification` dengan prioritas env > `system_settings`, dan verifikasi unit test membaca `BREVO_API_KEY` dari env tiruan

## 2. Konfigurasi dan uji SMTP yang jujur

- [x] 2.1 Perluas schema `POST /api/settings/smtp` dengan `emailProvider` + `brevoApiKey` dan simpan sebagai key `system_settings`, lalu verifikasi `GET /api/settings/smtp` mem-masking rahasia dan mengembalikan `isConfigured`
- [x] 2.2 Perbaiki `POST /api/settings/smtp/test` agar meneruskan `c.env` dan mengembalikan `provider` + `simulated` + pesan eksplisit (terkirim/simulasi/gagal), lalu verifikasi test manual menampilkan status yang benar untuk ketiga kondisi
- [x] 2.3 Tambah wiring `c.env` email di `src/server/worker.ts` dan verifikasi `npm run build` Workers tetap sukses (nodemailer tidak ikut ke bundle)

## 3. Skema dan endpoint kirim PO

- [x] 3.1 Tambah status `sent` + kolom `sentAt`/`sentTo` ke `purchase_orders` di `src/db/schema.ts`, generate migrasi, `bun run db:push` lokal, terapkan ke D1 remote, dan verifikasi `PRAGMA table_info(purchase_orders)` memuat kolom baru di kedua database
- [x] 3.2 Buat template HTML email PO di backend (nomor PO, tanggal, sekolah tujuan, tabel item judul/ISBN/jumlah, total, catatan dengan escaping) dan verifikasi render contoh PO memuat semua field wajib
- [x] 3.3 Tambah `POST /api/procurement/purchase-orders/:id/send` (404 bila PO hilang, 400 bila email supplier tidak valid, teruskan error provider secara eksplisit, update `sent`/`sentAt`/`sentTo` hanya bila benar-benar terkirim) dan verifikasi via test integrasi `procurement.test.ts`: kirim sukses, email kosong ditolak, kirim ulang memperbarui jejak

## 4. UI Procurement dan Settings

- [x] 4.1 Tambah tombol Kirim/Kirim Ulang PO + badge status pengiriman (`Terkirim`, `Simulasi`, `Gagal`) dengan `try/catch` dan pesan error eksplisit dari server di `ProcurementView.tsx`, lalu verifikasi tidak ada silent failure saat API 400/500 dan cek anti-slop (`rounded-2xl`/`rounded-xl` konsisten, label di atas input, CTA 1-3 kata, `active:scale`)
- [x] 4.2 Tambah dropdown provider + field API key + badge status transport di tab SMTP `SettingsView.tsx`, lalu verifikasi simpan/uji menampilkan provider yang dipakai

## 5. Verifikasi akhir

- [x] 5.1 Jalankan gerbang mutu berurutan dan pastikan semuanya hijau: `npm run type-check`, `npm run lint`, `npm run build`, `npm run test`, serta catat kegagalan pre-existing yang tidak terkait bila ada
- [ ] 5.2 Lakukan uji ujung-ke-ujung demo: buat supplier + PO, kirim PO via Brevo di Workers (inbox supplier menerima email lengkap), terima barang parsial/penuh dan pastikan status receiving tetap berjalan serta jejak `sentAt`/`sentTo` tidak hilang
  - Terverifikasi via kode (tanpa kredensial asli): kirim sukses → `sent`, kirim ulang update jejak, receiving parsial/penuh setelah `sent` mempertahankan `sentAt`/`sentTo` (regression test di `procurement.test.ts`, 38/38 hijau).
  - Menunggu kredensial user: Brevo API key + sender terverifikasi (`wrangler secret put BREVO_API_KEY`), lalu Klik "Kirim PO" di UI dan cek inbox supplier asli.
