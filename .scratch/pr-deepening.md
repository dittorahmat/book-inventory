## Summary
Refactoring pendalaman arsitektur codebase (Architecture Deepening Candidates 1, 2, dan 3) yang dihasilkan dari review sistem, diperkuat dengan resolusi review kode (eliminasi Middle Man & Data Clumps) dan peningkatan tooling hasil retrospektif:

1. **Candidate 1 — Unified Student Withdrawal Intake Seam**:
   - Menyatukan alur pembatalan pesanan akibat murid mundur (buku maupun seragam) ke modul seam polimorfik deep `student-withdrawal.ts` (`requestStudentWithdrawal`).
   - Menyediakan autoritas domain kanonik bersama untuk validasi keabsahan data murid di database dan panjang alasan pembatalan.

2. **Candidate 2 — Public Orders Sub-Router Decomposition**:
   - Mendekomposisi route publik terpadat (`public-orders.ts` dari 376 baris ke 318 baris) dengan mengekstrak route komplain retur (`/submit-return`) dan pengunduran diri (`/cancel-withdrawal`) ke sub-router fungsional `public-order-returns.ts`.
   - Menjaga 100% kompatibilitas kontrak API publik klien (`check:api-contract`).

3. **Candidate 3 — Term Reconciliation UI/Hook Extraction**:
   - Memecah view Berita Acara rekonsiliasi akhir periode (`TermReconciliationTab.tsx` dari 394 baris ke 197 baris).
   - Logika mutasi & kalkulasi diekstrak ke hook kanonik `useTermReconciliation.ts` dan tabel visual diekstrak ke `AuditCountsTable.tsx`.
   - Mengelompokkan metrik audit ke tipe data terstruktur kanonik `AuditTotals` (eliminasi bau kode *data clumps*).

4. **Retrospective & Tooling Improvements**:
   - Menambahkan warning otomatis di gate `check:file-size` untuk file route yang mendekati batas 400 baris (>=350 baris).
   - Menyediakan test fixture kanonik di `src/server/lib/test-fixtures.ts` (`createTestSchool`, `createTestStudent`, `createTestBookOrder`).
   - Penguatan aturan anti-kambuh AGENTS.md §0.32, §0.33, §0.38, dan §0.39.

## Perubahan Perilaku
Tidak ada (zero breaking changes). Seluruh kontrak API klien `/api/public/orders/*` dan alur rekonsiliasi tetap berfungsi identik.

## Verifikasi
- `bun run check:all` hijau (558 tests pass, 0 fail, 118 files, Vite build OK).
