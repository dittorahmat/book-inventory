## What to build

Memperbarui parser impor siswa (`student-import-parser`) dan helper classroom agar kode rombel mempertahankan format ruang kelas utuh per jenjang (contoh: `"1 INTER 1"`, `"2 INTER 1"`, `"1 MQ 1"`, `"2 MQ 1"`), bukan sekadar `"INTER 1"`. Menyajikan dropdown filter rombel di `StudentsView` dengan daftar ruang kelas lengkap per jenjang secara terurut dan rapi sehingga staf dapat membedakan murid Kelas 1 dan Kelas 2.

## Acceptance criteria

- [ ] Fungsi parser `normalizeAlWildanClass` dan `parseStudentData` mengekstrak dan mempertahankan format ruang kelas utuh per jenjang (`1.INTER 1` -> `"1 INTER 1"`, dsb.).
- [ ] Dropdown filter rombel di antarmuka menampilkan opsi per jenjang yang jelas (`1 INTER 1`, `1 INTER 2`, `2 INTER 1`, dst.) dan terurut rapi.
- [ ] Murid dari jenjang berbeda tidak lagi tergabung di bawah satu pilihan rombel generik.
- [ ] Label kelas di tabel siswa, form modal, dan preview impor menyajikan format ruang kelas secara konsisten tanpa duplikasi prefix jenjang.
- [ ] Unit test parser, helper classroom, dan komponen UI diperbarui dan memvalidasi format ruang kelas berjenjang.

## Blocked by

- #450
