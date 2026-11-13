## What to build

Menambahkan kolom `rombel` (nullable) pada tabel `students`, memperbarui parser impor Excel siswa agar mengekstrak rombel secara kanonik (misalnya dari format `"1.INTER 1"` menjadi `gradeLevel: "1"`, `curriculumType: "INTER"`, `rombel: "INTER 1"`), memperluas endpoint siswa (`POST /api/students`, `PUT /api/students/:id`, `POST /api/students/bulk-import`) untuk menerima dan menyimpan `rombel`, serta menyediakan skrip migrasi data untuk melengkapi kolom `rombel` pada 714 siswa SD Al-Wildan 1 (`school-alw-1`) dari file `DATA SISWA SD AL-WILDAN 1 TP. 2026-2027.xlsm` tanpa merusak relasi pesanan/order eksisting.

Sesuai ADR 0023.

## Acceptance criteria

- [ ] Skema `students` di `src/db/schema.ts` memiliki kolom `rombel` (`text("rombel")`, nullable).
- [ ] Berkas migrasi D1 baru dihasilkan (`bun run db:generate`) dan skema lokal tersinkronisasi.
- [ ] Fungsi `normalizeAlWildanClass` dan `parseStudentData` di `src/lib/student-import-parser.ts` mengekstrak `rombel` dengan benar (misal `"1.INTER 1"` -> `rombel: "INTER 1"`), dan baris tanpa rombel (seperti "Cuti") menghasilkan `rombel: null`.
- [ ] Endpoint `POST /api/students`, `PUT /api/students/:id`, dan `POST /api/students/bulk-import` memvalidasi dan memvalidasi persistensi `rombel`.
- [ ] Skrip migrasi batch (misal `scripts/backfill-student-rombel-alw1.ts`) tersedia dan sukses memetakan rombel 714 murid Al-Wildan 1 berdasarkan NIS dari file Excel.
- [ ] Unit test parser (`student-import-parser.test.ts`) dan route test (`students.test.ts`, `students-bulk.test.ts`) memvalidasi persistensi field `rombel`.
- [ ] `bun run check:fast` lulus bersih.

## Blocked by

None (can start immediately).
