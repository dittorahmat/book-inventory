# Pencarian partisi dulu, FTS nanti

Substring `%q%` boleh dalam partisi terindeks (`school_id = ?` + `LIMIT`); FTS5 token-prefix (`salsa*`) hanya Tahap 2 untuk pencarian global bervolume agar "Salsa" tetap ketemu "Annisa Salsabila" tanpa pindai penuh.

## Considered Options

- Prefix `LIKE 'q%'` global vs substring-dalam-partisi (dipilih: substring-dalam-partisi — UX tidak melemah, D1 pakai indeks `school_id` lalu pindai kecil per sekolah).
- Tambah dropdown sekolah di portal search vs biarkan global (dipilih: tambah dropdown wajib — menutup full-scan termahal + mengurangi nama kembar antar 180 sekolah).
- FTS5 sekarang vs nanti berbasis bukti (dipilih: nanti — virtual table + trigger mahal; aktif bila `EXPLAIN QUERY PLAN` masih `SCAN` dan p95 >500ms di 10rb murid).

## Consequences

Tahap 1: `WHERE` SQL + `LIMIT` 10–50 + indeks komposit (`students(school_id,status,name/nis)`, dst.) + migrasi remote terverifikasi. Setiap search baru/ubah wajib `EXPLAIN QUERY PLAN` (`SEARCH USING INDEX`) + test volume.

## Amandemen: tokenizer FTS5 Tahap 2 (2026-10-09)

Postgres (`pg_trgm`/`tsvector`) tidak tersedia di stack SQLite/D1 — padanannya murni FTS5 bawaan, tanpa ekstensi baru:

- Default: tokenizer `unicode61`/`porter` + query token-prefix (`salsa*`) + ranking `bm25()` — murah, menjangkau "Annisa Salsabila". Ini pilihan pertama Tahap 2.
- Bila terbukti butuh substring tengah-token/toleransi typo: `tokenize="trigram"` (padanan `pg_trgm`) — dengan catatan indeks ~3–5x lebih besar, timbang terhadap ukuran D1, dan tanpa operator similarity `%` (rumuskan sebagai `MATCH` + `bm25` manual).
- Dilarang mendesain Tahap 2 bergantung ekstensi `spellfix1` sebelum ketersediaannya diverifikasi di remote D1 (FTS5 sendiri terdokumentasi tersedia).
