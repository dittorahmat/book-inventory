# ADR 0023: Atribut Rombel / Ruang Kelas Murid dan Agregasi Distribusi

- **Status**: Accepted
- **Tanggal**: 2026-11-13
- **Konteks**:
  Sebelumnya, entitas murid (`students`) hanya menyimpan `grade_level` (misal: "1", "2") dan `curriculum_type` (program studi: "INTER", "MQ"). Informasi ruang kelas / rombongan belajar murid (seperti "INTER 1", "INTER 2", "MQ 1", "MQ 2" dari berkas master Excel sekolah) terbuang saat parsing `normalizeAlWildanClass`. Ketiadaan informasi rombel ini membatasi staf kasir/gudang dalam memfilter murid, serta mencegah agregasi laporan pemenuhan dan distribusi buku maupun seragam per ruang kelas fisik.

- **Keputusan**:
  1. Menambahkan kolom `rombel` (`text("rombel")`, nullable) pada tabel `students` di `src/db/schema.ts`. Kolom bersifat nullable agar tidak memblokir registrasi mandiri murid baru via portal publik sebelum penempatan kelas resmi dilakukan oleh pihak sekolah.
  2. Memperbarui `normalizeAlWildanClass` dan parser Excel di `src/lib/student-import-parser.ts` agar mengekstrak rombel spesifik (misal dari `"1.INTER 1"` menjadi `gradeLevel: "1"`, `curriculumType: "INTER"`, `rombel: "INTER 1"`).
  3. Menyediakan helper kanonik untuk menyusun label ruang kelas utuh (misal `"1 INTER 1"` dari `gradeLevel` + `rombel`).
  4. Mendukung filter `rombel` pada antarmuka master data siswa, pencarian kasir, dan penyerahan barang di gudang.
  5. Menyediakan metrik rekapitulasi / breakdown status distribusi buku dan seragam berdasarkan ruang kelas pada dashboard pelaporan staf.
  6. Menerapkan migrasi D1 non-destruktif (`ALTER TABLE students ADD COLUMN rombel TEXT;`) dan skrip sinkronisasi batch pembaruan data murid `school-alw-1` dari master Excel tanpa merusak integritas relasi pesanan/order eksisting.

- **Konsekuensi Positif**:
  - Pelacakan fisik dan pembagian logistik buku/seragam di sekolah cabang dapat diagregasikan langsung per ruangan kelas riil.
  - Data historis dan data baru tetap kompatibel tanpa memicu kegagalan constraint D1.
