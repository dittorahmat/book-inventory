# Laporan tambah dimensi kategori, program tetap di dasbor

Kebutuhan flowchart "per kategori buku" dipenuhi dengan dimensi `byCategory` di rekap penjualan (sumber `books.category`, paket diurai via BOM, fallback "Tanpa Kategori"). Potongan per program (jenjang/kurikulum) tidak dibuat baru karena sudah ada di rincian dasbor per sekolah.

## Considered Options

- Laporan program baru vs pakai dasbor yang ada (dipilih: dasbor — duplikasi agregasi menambah utang tanpa bukti kebutuhan).
- Kategori hanya satuan vs termasuk paket (dipilih: termasuk paket via BOM agar omzet paket teratribusi penuh).

## Consequences

CSV sejajar JSON untuk total yang ada; kategori ditambah sebagai bagian baru. Filter `schoolId` + periode + `WHERE` di SQL tidak berubah (§11); buktikan dengan `EXPLAIN QUERY PLAN` + uji volume.
