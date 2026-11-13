## What to build
Menambahkan scanner otomatis pada gate mekanis anti-kambuh (scripts/check-test-isolation.ts atau gate terintegrasi) untuk mendeteksi operasi mutasi destruktif tanpa filter WHERE (db.delete(table)) pada tabel master di seluruh file pengujian *.test.ts(x).

## Acceptance criteria
- [ ] Gate mendeteksi dan menolak kode baru di pengujian yang mengeksekusi db.delete(table) tanpa filter .where(...) untuk tabel master (bookPackages, books, schools, students, uniformVariants, dll).
- [ ] Terdaftar di pre-commit (check:fast) dan suite check:all.
- [ ] Dokumentasi aturan tercermin pada docs/rules/testing-tooling.md dan AGENTS.md §6.1.

## Blocked by
- #454
