## What to build

Menampilkan informasi ruang kelas kanonik (misalnya `"1 INTER 1"` dari gabungan `gradeLevel` dan `rombel`) pada antarmuka master data siswa, modal formulir murid, modal preview impor massal, serta antarmuka operasional kasir dan pencarian siswa di gudang. Staf dapat memfilter daftar murid berdasarkan rombel untuk mempercepat verifikasi fisik saat pembagian buku atau seragam.

Sesuai ADR 0023.

## Acceptance criteria

- [ ] Tabel data siswa (`StudentTable.tsx`, `StudentsView.tsx`) menampilkan kolom ruang kelas dan menyediakan dropdown filter rombel yang dinamis sesuai jenjang/sekolah yang dipilih.
- [ ] Formulir tambah/edit murid (`StudentFormModal.tsx`) memiliki input field untuk `rombel` (opsional).
- [ ] Modal preview impor siswa (`StudentImportPreview.tsx`) menampilkan kolom rombel yang terdeteksi dari berkas Excel.
- [ ] Tampilan pencarian kasir (`StudentSearchStep.tsx` / `StudentOrdersTable.tsx`) menampilkan badge rombel siswa di samping nama/NIS.
- [ ] Komponen UI lulus tes interaksi dan render sesuai standar anti-polusi DOM (`StudentTable.test.tsx` atau sejenisnya).
- [ ] `bun run check:fast` lulus bersih.

## Blocked by

- #445 (feat(students): skema rombel, parser impor excel & sinkronisasi data murid AW 1)
