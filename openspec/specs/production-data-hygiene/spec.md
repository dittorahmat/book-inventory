# production-data-hygiene Specification

## Purpose

Menjaga database production (Cloudflare D1) bebas dari baris pola-uji/QA yang bocor ke
production — vektor insiden "175 sekolah sampah" (Okt 2026) — dengan alarm otomatis yang
terlihat manusia dan pembersihan yang terverifikasi (§6 AGENTS.md).

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
- **Then** sistem tidak mengirim email lagi dan melaporkan `skipped: "sampah sama dengan alarm terakhir"`.

#### Scenario: Production bersih kembali

- **Given** tidak ada lagi baris berpola uji di `schools`
- **When** Cron Trigger dijalankan
- **Then** sidik alarm dihapus dari `system_settings` sehingga sampah baru di masa depan tetap dialarmkan
- **And** sistem melaporkan `skipped: "production bersih"` tanpa mengirim email.

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
