# YAGNI, one-liner, dan batas free-tier Cloudflare

Terapkan YAGNI (hapus kode mati, kanonikalisasi helper, tanpa spekulasi) dan one-liner tanpa mengubah perilaku, dengan semua tulis D1 lewat chunk max 10 baris + `db.batch()` sekuensial agar aman di limit Workers/D1/R2 free-tier.

## Considered Options

- Refactor besar monolit >400 baris sekaligus vs quick-wins dulu (dipilih: quick-wins dulu, monolit per file agar gate `check:file-size` tetap hijau).
- `Promise.all` untuk tulis vs sekuensial/`db.batch()` (dipilih: sekuensial/`db.batch()` karena D1 menolak tulis konkuren — insiden 500 Okt 2026).

## Consequences

Test volume 30+ baris wajib untuk setiap endpoint tulis bervolume; error D1 dipetakan ke 4xx, bukan 500 generik.
