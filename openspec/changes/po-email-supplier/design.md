## Context

Lihat `proposal.md` (Why) untuk motivasi. Kondisi saat ini yang membentuk pendekatan:

- `src/server/services/email.ts` adalah stub: tanpa kredensial → `simulated:true`, dengan kredensial → `console.log` + klaim terkirim tanpa transport nyata. `sendEmailNotification()` tidak menerima `env`, sehingga secret Workers tidak bisa dibaca.
- `src/server/worker.ts` hanya wiring D1/R2; layer email tidak mendapat `c.env`.
- `purchase_orders.status` memiliki enum `draft | ordered | partially_received | received | cancelled`; `draft` tidak pernah dipakai (create langsung `ordered`). Tidak ada kolom jejak kirim.
- `suppliers.email` opsional; validasi kirim PO harus menuntut email valid tanpa mengubah validasi pembuatan supplier.
- Target deploy ganda: Cloudflare Workers (tanpa socket TCP/SMTP, bundle sensitif) dan Bun/VPS (Node-compat, bisa Nodemailer). Lihat `specs/system/email-transport/spec.md` dan `specs/procurement/po-email-delivery/spec.md` untuk kontrak perilaku.

## Goals / Non-Goals

**Goals:**

- Satu API `sendEmailNotification()` yang bekerja di kedua runtime dengan pemilihan transport eksplisit dan hasil jujur (`provider`, `messageId`, `simulated`).
- Pengiriman PO ke supplier dengan jejak `sent`/`sentAt`/`sentTo` dan kirim ulang, tanpa mengganggu receiving.
- Kredensial rahasia tidak pernah bocor ke frontend; kegagalan provider (misal sender belum terverifikasi) tampil eksplisit.

**Non-Goals:**

- PDF formal, portal supplier, approval, surat jalan balik, WhatsApp (tetap di luar scope, lihat proposal).
- Mengubah alur receiving, transfer antar-sekolah, atau surat jalan siswa (`SJ-SERAH-*`).

## Decisions

### 1. Transport ganda dengan factory + runtime detection, bukan dua service terpisah

Pendekatan: satu interface `EmailProvider.send()` dengan dua implementasi — `BrevoHttpProvider` (fetch ke `https://api.brevo.com/v3/smtp/email`, header `api-key`) dan `SmtpProvider` (Nodemailer, dynamic `await import("nodemailer")` agar tidak masuk bundle Workers). Factory memilih berdasarkan `email_provider` (`auto | brevo | smtp`) + ketersediaan kredensial + deteksi runtime (ada `Bun` vs ada `c.env.DB`).

Alternatif dipertimbangkan: hanya Nodemailer untuk semua — ditolak karena Workers tidak bisa buka TCP SMTP (port 587/465), sehingga demo akan selalu gagal. Hanya Brevo untuk semua — ditolak karena memaksa dependensi vendor eksternal untuk instalasi lokal/VPS yang mungkin offline atau memakai relay internal.

### 2. Brevo via HTTP API, bukan "SMTP Brevo"

Workers hanya mengizinkan egress HTTP(S); kredensial yang dipakai adalah API key (`xkeysib-*`), bukan password SMTP. Endpoint test dan kirim PO di Workers selalu lewat jalur ini. Di Bun/VPS, SMTP relay Brevo (`smtp-relay.brevo.com:587`) tetap bisa dipakai lewat `SmtpProvider` bila diinginkan — satu kredensial, dua jalur.

### 3. `c.env` diteruskan eksplisit ke layer email

`sendEmailNotification(opts, env?)` dan `getSmtpConfig(env?)`: baca `env.BREVO_API_KEY` / `env.SMTP_*` dengan prioritas env di atas `system_settings` lalu `process.env`. `worker.ts` meneruskan `c.env`, route settings/procurement meneruskan `c.env` yang diterima Hono. Tanpa ini, secret yang dipasang via `wrangler secret` tidak akan terbaca.

### 4. Jejak kirim sebagai kolom di `purchase_orders`, bukan tabel log terpisah

Tambah `status` enum `sent` + kolom `sentAt`, `sentTo` (string tanggal ISO dan email tujuan). Transisi yang diizinkan: `ordered → sent → partially_received → received`; `sent → sent` (kirim ulang) memperbarui `sentAt`/`sentTo`. Alasan: kebutuhan audit minimal ("kapan dan ke mana PO dikirim") tanpa menambah tabel dan join baru; tabel log terpisah dipertimbangkan tapi ditolak sebagai over-engineering untuk Opsi B.

### 5. Template HTML di server, bukan di frontend

Fungsi `renderPurchaseOrderEmail(po)` di backend menghasilkan `subject` + `html` (kop sekolah, nomor PO, tabel item, total, tujuan, catatan) dengan escaping HTML untuk `notes`/nama. Frontend hanya memicu dan menampilkan hasil. Alasan: satu sumber kebenaran untuk isi email baik dari tombol Procurement maupun potensi pemicu lain; frontend tidak dipercaya membangun dokumen resmi.

### 6. Validasi dan pesan jujur

- Zod: `POST /purchase-orders/:id/send` tanpa body (mengambil email dari supplier); 404 bila PO hilang, 400 bila email supplier kosong/tidak valid, 502/400 dengan pesan provider bila pengiriman gagal.
- Respons selalu memuat `provider` (`brevo | smtp | simulated`) dan `simulated` boolean; UI menampilkan badge berbeda untuk ketiganya dan tidak pernah menulis "berhasil dikirim" saat simulasi.

## Risks / Trade-offs

- [Risk] Klaim "terkirim" padahal Brevo menolak (sender belum verifikasi, key salah) → Mitigasi: perlakukan respons non-2xx sebagai gagal, teruskan pesan error provider ke UI, jangan ubah status PO menjadi `sent`.
- [Risk] Bundle Workers membesar/pecah karena Nodemailer → Mitigasi: dynamic import di dalam `SmtpProvider` saja + verifikasi `npm run build` untuk Workers sebelum merge.
- [Risk] Enum status baru merusak query/filter lama → Mitigasi: filter UI menambah opsi `Terkirim`; query existing yang memfilter `ordered/partially_received/received` tetap valid karena `sent` adalah status tambahan di antara `ordered` dan receiving.
- [Risk] Spam/bounce karena alamat supplier basi → Mitigasi: kirim ulang manual (bukan otomatis berulang), tampilkan `sentTo` terakhir, validasi format email sebelum kirim.
- [Risk] Secret bocor via `GET /smtp` → Mitigasi: samakan perlakuan `brevo_api_key` dengan password (masking + `isConfigured`), audit respons endpoint.

## Migration Plan

1. Tambah `nodemailer` + `@types/nodemailer` sebagai dependency; pastikan dynamic import.
2. Tambah key `system_settings`: `email_provider`, `brevo_api_key`, `brevo_api_url` (tanpa migrasi tabel, key-value).
3. `db:generate` untuk kolom PO (`sent` enum + `sentAt` + `sentTo`); `db:push` lokal; terapkan file SQL migrasi ke D1 remote (`wrangler d1 execute --remote --file=...`) dan verifikasi `PRAGMA table_info(purchase_orders)`.
4. Pasang secret demo: `wrangler secret put BREVO_API_KEY`; verifikasi sender di dashboard Brevo.
5. Deploy bertahap: settings/test jujur dulu → kirim PO → badge UI. Rollback: kembalikan status PO yang `sent` ke `ordered` via update langsung bila endpoint harus dimatikan sementara; transport lama (simulasi) tetap menjadi fallback aman.
6. Jalankan `type-check`, `lint`, `build`, dan suite `bun test` sesuai AGENTS.md sebelum commit.

## Open Questions

- Apakah nama pengirim dan kop HTML perlu mengikuti identitas per-sekolah (`targetSchoolId`) atau satu identitas global (`Al Wildan School Logistics`)? Default usulan: global, dapat diubah kemudian tanpa mengubah spec.
- Apakah `expectedArrivalDate` perlu ditampilkan di email PO? Default usulan: ya bila terisi.
