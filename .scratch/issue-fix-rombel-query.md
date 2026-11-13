## What to build

Memperbaiki fungsi `fetchStudents` di klien antarmuka agar meneruskan parameter `rombel` dalam query string HTTP ke backend `/api/students`, serta memastikan query filtering di server memfilter data murid secara presisi berdasarkan rombel yang dipilih staf di dropdown antarmuka.

## Acceptance criteria

- [ ] Parameter `rombel` disertakan dalam query HTTP pada `fetchStudents` ketika nilainya bukan `'all'`.
- [ ] Backend `/api/students?rombel=...` merespons dengan daftar murid yang sesuai dengan kriteria rombel secara akurat tanpa menampilkan record rombel lain.
- [ ] Memilih opsi rombel di dropdown antarmuka Data Siswa langsung memicu pembaruan daftar murid sesuai filter tanpa fallback ke data awal/default.
- [ ] Pengujian unit di klien dan pengujian route di backend memverifikasi alur filter rombel secara end-to-end.

## Blocked by

- None (can start immediately).
