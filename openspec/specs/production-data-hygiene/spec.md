# production-data-hygiene Specification

## Purpose

Menjaga database production (Cloudflare D1) sehat lewat alarm otomatis yang terlihat manusia:
bebas dari baris pola-uji/QA yang bocor ("175 sekolah sampah", Okt 2026) **dan** bebas dari drift
skema yang membuat endpoint 500 padahal test lokal hijau (§1, §6 AGENTS.md).

## Requirements

### Requirement: Alarm Otomatis Sampah Data-Uji

Sistem harus memindai tabel `schools` di production D1 secara berkala lewat Cron Trigger Worker
(`[triggers] crons` di `wrangler.toml`, handler `scheduled`) dan memberi tahu staf pusat bila ada
baris yang cocok dengan sidik kanonik `isTestSeedValue`. Alarm memakai binding D1 langsung
sehingga tidak memerlukan kredensial Cloudflare tambahan.

#### Scenario: Sampah baru terdeteksi

- **Given** ada baris sekolah di production D1 dengan id atau nama berpola uji (`school-test-*`, `Sekolah school-*`, `SUP-WF-*`, dst.)
- **When** Cron Trigger dijalankan dan himpunan sampah berbeda dari alarm terakhir
- **Then** sistem mengirim email alarm ke seluruh pengguna berperan `central_admin`
- **And** sidik himpunan sampah disimpan di `system_settings` dengan kunci `d1_junk_alert_signature`.

#### Scenario: Anti alarm-fatigue

- **Given** himpunan sampah identik dengan alarm terakhir yang sudah terkirim
- **When** Cron Trigger dijalankan
- **Then** sistem tidak mengirim email lagi dan melaporkan `outcome: "unchanged"`.

#### Scenario: Production bersih kembali

- **Given** tidak ada lagi baris berpola uji di `schools`
- **When** Cron Trigger dijalankan
- **Then** sidik alarm dihapus dari `system_settings` sehingga sampah baru di masa depan tetap dialarmkan
- **And** sistem melaporkan `outcome: "clean"` tanpa mengirim email.

#### Scenario: Pengiriman gagal dicoba ulang

- **Given** seluruh pengiriman email pada satu putaran gagal
- **When** Cron Trigger dijalankan
- **Then** sidik alarm **tidak** disimpan sehingga putaran berikutnya mencoba mengirim lagi.

### Requirement: Sidik Pola Data-Uji Tunggal

Keputusan "baris ini sampah uji?" harus berasal dari satu predicate kanonik
(`src/server/services/d1-junk-scan.ts` yang memakai `isTestSeedValue`), dipakai bersama oleh
alarm cron production dan alarm manual pre-merge `bun run check:d1-junk` (§8: dilarang helper duplikat).

#### Scenario: Alarm manual dan otomatis konsisten

- **Given** sebuah id sekolah berpola uji
- **When** diperiksa oleh `bun run check:d1-junk` (via wrangler, manual pre-merge) maupun oleh alarm cron
- **Then** keduanya memakai predicate yang sama sehingga hasil deteksinya identik.

### Requirement: Alarm Otomatis Drift Skema

Sistem harus membandingkan skema yang dilihat ORM (`src/db/schema.ts`) dengan skema live di
production D1 pada Cron Trigger yang sama, dan memberi tahu staf pusat bila ada tabel atau kolom
yang hilang — kelas insiden §1 di mana migrasi tidak teraplikasi ke remote sehingga endpoint
mengembalikan 500 (`no such table` / `no such column`) padahal test lokal hijau. Sebelum ini gate
`bun run check:d1-drift` hanya bisa dijalankan manual karena butuh kredensial Cloudflare; alarm ini
memakai binding D1 sehingga tidak butuh kredensial. Tabel ekstra di remote (tidak ada di
`schema.ts`) bukan temuan.

#### Scenario: Migrasi tertinggal dari schema.ts

- **Given** sebuah tabel atau kolom ada di `schema.ts` tetapi tidak ada di production D1
- **When** Cron Trigger dijalankan
- **Then** sistem mengirim email alarm ke seluruh `central_admin` yang menyebut tabel/kolom hilang itu
- **And** sidiknya disimpan di `system_settings` dengan kunci `d1_drift_alert_signature`.

#### Scenario: Skema hasil migrasi terbukti sinkron

- **Given** database hasil penerapan seluruh file `drizzle/00*.sql`
- **When** pemindaian drift dijalankan
- **Then** tidak ada temuan, sehingga test `scanDrift` pada database terisolasi menjadi bukti
  bahwa migrasi tidak tertinggal dari `schema.ts` sebelum seseorang menyentuh production.

### Requirement: Inti Alarm Bersama

Sidik/anti-spam/pengiriman email kedua alarm harus berasal dari satu modul
(`src/server/services/d1-alarm.ts`) — bukan dua implementasi paralel (§8) — dengan hasil
terstruktur `{ count, recipients, sent, outcome, errors? }`; `outcome` bernilai
`clean` | `unchanged` | `no-recipients` | `notified` | `notify-failed`.

#### Scenario: Sidik hanya disimpan bila ada email terkirim

- **Given** alarm punya temuan baru tetapi seluruh pengiriman email gagal
- **When** alarm dijalankan
- **Then** `outcome` bernilai `notify-failed` dan sidik **tidak** disimpan, sehingga putaran
  berikutnya mengirim ulang alih-alih diam selamanya.
