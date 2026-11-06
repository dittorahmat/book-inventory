## Ringkasan Perubahan

Refactoring dokumentasi repo untuk membagi aturan monolitik `AGENTS.md` ke dalam pointer modular guna mereduksi beban context window agen AI.

1. **Modularisasi Aturan Domain (`docs/rules/*.md`)**:
   - Membagi 56 butir mandat anti-kambuh (§0.1 s/d §0.56) ke dalam 5 dokumen domain tematik:
     - `docs/rules/portal-client.md`
     - `docs/rules/orders-payments.md`
     - `docs/rules/logistics-stock.md`
     - `docs/rules/database-d1.md`
     - `docs/rules/testing-tooling.md`
   - Mempertahankan penomoran kanonik asli (`§0.x`) di setiap heading agar tautan referensi historis dan komentar kode tetap stabil.

2. **Perampingan AGENTS.md**:
   - Memangkas root `AGENTS.md` dari 571 baris menjadi **127 baris** (~80% reduksi token context load).
   - Menambahkan tabel navigasi **Context Pointers** (§0) dengan pemetaan path direktori/file target ke dokumen aturan wajib.

3. **Pencegahan Kambuh Mekanis**:
   - Menambahkan gate `check:rule-pointers` (`scripts/check-rule-pointers.ts`) yang memastikan `AGENTS.md` tidak melebihi 150 baris dan memverifikasi bahwa ke-56 aturan anti-kambuh terdefinisi lengkap di `docs/rules/*.md`.
   - Memperbarui pesan error di `scripts/check-*.ts` agar mengarah ke dokumen modular baru.

## Perubahan perilaku
Tidak ada (refactor dokumentasi dan penambahan gate CI murni).
