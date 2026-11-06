## Ringkasan Perbaikan

Menindaklanjuti temuan review kode pada transparansi counter anti-duplikasi:
1. **Pemisahan Baris Cacat vs Baris Duplikat**: Mengekstrak helper kanonik `calculateDedupMetrics` (`src/lib/intake-dedup.ts`) dengan rumus `max(0, rawReadCount - (uniqueCount + skippedInvalidCount))`. Mengatasi bug conflation di mana baris format tidak valid/kosong (`skippedRows`) keliru dihitung sebagai duplikat pada pratinjau buku dan siswa.
2. **Konsistensi Akumulasi Baris Mentah Folder Batch**: Menambahkan akumulasi baris cacat `newSkipped.length` pada `handleBatchProcessFile` di modal buku dan murid agar konsisten dengan mode berkas tunggal.
3. **Eksposisi Prop `rawItemsCount` pada `DriveFolderBatchRunner`**: Memenuhi checklist spesifikasi dengan menyediakan dan memprioritaskan prop `rawItemsCount` eksplisit di atas kalkulasi internal.
4. **Mandat Anti-Kambuh AGENTS.md §0.56**: Menambahkan aturan anti-kambuh nomor 56 terkait pemisahan baris cacat vs duplikat dan standarisasi helper `calculateDedupMetrics`.

## Verifikasi
- Unit test suite baru dan eksisting lolos (`bun test src/lib/intake-dedup.test.ts src/components/ui/DriveFolderBatchRunner.test.tsx src/components/books/BookBulkUploadModal.test.tsx src/components/students/StudentBulkUploadModal.test.tsx`).
- Seluruh gate `check:fast` (type-check, eslint, file-size < 400 lines, dead exports, single writer, test isolation) lolos hijau.
