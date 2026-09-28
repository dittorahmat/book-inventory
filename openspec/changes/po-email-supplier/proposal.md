## Why

Purchase Order (PO) ke supplier hari ini hanya tercatat internal (`ordered` → `partially_received` → `received`) dan tidak pernah terkirim ke supplier. Kolom `email` supplier disimpan tapi tidak dipakai, dan `sendEmailNotification()` masih stub simulasi sehingga tombol "Kirim Email Tes" pun tidak benar-benar mengirim. Akibatnya admin harus meneruskan PO manual via WA/email pribadi tanpa bukti kirim di sistem.

## What Changes

- Tambah aksi **Kirim / Kirim Ulang PO via email** ke `supplier.email` langsung dari modul Pengadaan (ProcurementView) dengan status pengiriman yang jujur (`Terkirim via Brevo/SMTP`, `Simulasi`, `Gagal`).
- Tambah status dan jejak kirim PO: status `sent` + kolom `sentAt` / `sentTo` pada `purchase_orders`, tanpa mengubah alur receiving yang sudah ada.
- Perbaiki `sendEmailNotification()` dari stub menjadi implementasi nyata dengan **transport ganda**: Brevo HTTP API untuk demo Cloudflare Workers, Nodemailer SMTP untuk lokal/VPS, plus mode simulasi eksplisit bila kredensial kosong.
- Perbaiki endpoint uji SMTP agar mengembalikan provider yang dipakai dan pesan yang jujur (tidak lagi "berhasil dikirim" saat simulasi).
- Tambah template HTML email PO (kop sekolah, nomor PO, tabel item, total, sekolah tujuan, catatan).
- Validasi `supplier.email` wajib saat kirim PO; pembuatan supplier tetap boleh tanpa email.

## Capabilities

### New Capabilities

- `procurement/po-email-delivery`: pengiriman PO ke email supplier, status `sent`, jejak `sentAt/sentTo`, kirim ulang, dan template email PO.
- `system/email-transport`: transport email ganda runtime-agnostik (Brevo HTTP untuk Workers, SMTP/Nodemailer untuk Bun/VPS, simulasi eksplisit) beserta konfigurasi provider dan endpoint uji yang jujur.

### Modified Capabilities

- Tidak ada. Tidak ada spec existing di `openspec/specs/`; alur receiving PO dan transfer antar-sekolah tidak berubah.

## Impact

- Backend: `src/server/services/email.ts` (dipecah jadi provider + factory), `src/server/routes/settings.ts` (schema + test jujur), `src/server/routes/procurement.ts` (endpoint kirim PO), `src/server/worker.ts` (teruskan `c.env` email), `src/db/schema.ts` (status `sent` + kolom kirim PO).
- Frontend: `src/views/ProcurementView.tsx` (tombol kirim + badge status), `src/views/SettingsView.tsx` (pilih provider + field API key + status).
- Dependensi baru: `nodemailer` (+ types) dipakai via dynamic import agar bundle Workers aman; tidak ada lib PDF pada tahap ini (HTML email saja).
- Operasional: butuh Brevo API key + sender terverifikasi untuk demo Workers; migrasi D1 lokal + remote untuk kolom PO baru; test regresi `procurement.test.ts` dan SMTP.
- Non-goal (tetap di luar scope): portal supplier, approval/reject supplier, surat jalan balik, PDF formal, kanal WhatsApp.
