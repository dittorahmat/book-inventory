# Domain Intake & Anti-Duplikasi

Pedoman arsitektur dan penegakan logika intake masal (katalog buku, siswa, seragam) dari file eksternal (Excel, CSV, Google Sheets, Google Drive).

## 1. Pemisahan Baris Cacat vs Baris Duplikat (Anti-Conflation)
- Seluruh perhitungan metrik deduplikasi wajib memusat ke helper kanonik `calculateDedupMetrics` (`src/lib/intake-dedup.ts`).
- Formula deterministik:
  $$\text{duplicateCount} = \max(0, \text{rawReadCount} - (\text{uniqueCount} + \text{skippedInvalidCount}))$$
- **Dilarang keras**: mengurangkan baris unik langsung dari total baris terbaca (`totalRawRead - uniqueCount`) tanpa memperhitungkan `skippedRows` (baris judul/NIS kosong, format rusak), karena akan mengelabui pengguna dengan mengklaim baris rusak sebagai baris duplikat.

## 2. Konsistensi Akumulasi Baris Mentah Batch Runner
- Pada pemrosesan batch folder (`DriveFolderBatchRunner`), handler `onProcessFile` wajib konsisten mengembalikan dan mengakumulasi seluruh baris fisik yang dibaca (`valid.length + skipped.length`).
- Komponen batch runner wajib mengekspos prop `rawItemsCount` dan memprioritaskannya jika disediakan oleh komponen induk.

## 3. Disiplin Unit Test Komponen Pratinjau
- Setiap pengujian komponen pratinjau import (`BookImportPreview`, `StudentImportPreview`) wajib memiliki minimal 1 skenario batas dengan `skippedRows > 0` dan `duplicates = 0` untuk membuktikan bahwa baris cacat tidak bocor ke badge notifikasi duplikat.
