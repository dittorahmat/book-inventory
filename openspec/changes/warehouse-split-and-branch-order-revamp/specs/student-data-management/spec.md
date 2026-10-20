# Spec Delta

## ADDED Requirements

### Requirement: Pencatatan dan Tampilan Tanggal Aktual Penerimaan Buku
Sistem SHALL mencatat stempel waktu aktual ketika buku fisik diserahkan kepada siswa/wali murid dan menampilkannya pada tabel dan rincian penerimaan siswa.

#### Scenario: Petugas menandai penyerahan buku siswa
- **WHEN** petugas gudang atau staf cabang menyelesaikan proses serah terima buku kepada siswa
- **THEN** sistem menyimpan tanggal dan waktu penyerahan secara eksplisit dan menampilkannya pada kolom "Tanggal Penerimaan Buku" di tabel penerimaan siswa

### Requirement: Hak Akses Seluruh Data Siswa dengan Filter Cabang untuk Gudang Pusat
Sistem SHALL mengizinkan admin gudang pusat untuk melihat data seluruh siswa lintas cabang dan menyediakan filter dropdown pemilihan cabang untuk mempermudah pengecekan dan audit logistik.

#### Scenario: Admin gudang pusat memfilter data siswa per cabang
- **WHEN** admin gudang pusat membuka halaman data siswa dan memilih cabang "SD Al-Washliyah 1" pada dropdown filter cabang
- **THEN** tabel data siswa langsung menampilkan daftar siswa yang terdaftar khusus pada cabang tersebut

#### Scenario: Admin gudang pusat melihat seluruh siswa tanpa filter
- **WHEN** admin gudang pusat memilih opsi "Semua Cabang" pada filter cabang
- **THEN** sistem menampilkan data gabungan siswa dari seluruh cabang yang terdaftar
