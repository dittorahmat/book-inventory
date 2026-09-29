## 1. State dan handler pencarian

- [x] 1.1 Tambah `pendingNoResult: string | null` + `confirmCreateNewStudent`, `cancelNoResult`, `editNoResultKeyword` di `usePublicOrder`, ubah `handleSearch` kosong agar set pending (bukan `isNewStudentMode`), dan verifikasi via test hook bahwa search kosong membuka pending tanpa prefill.
- [x] 1.2 Tunda prefill `newStudent.name` ke `confirmCreateNewStudent` dan bersihkan pending di `resetOrderFlow` + perpindahan tab order/return, verifikasi Batal/edit tidak mengubah form dan reset menutup dialog.

## 2. Komponen modal konfirmasi

- [x] 2.1 Buat `src/components/portal/NoResultConfirmModal.tsx` (controlled: `query`, `onConfirm`, `onEditKeyword`, `onCancel`) dengan copy final, echo query, tiga tombol, `role="dialog"` + `aria-modal`, Esc/backdrop close, `max-h-[90vh] overflow-y-auto`, dan verifikasi render manual + `bun run check:file-size` lolos.
- [x] 2.2 Wire modal di `PublicOrderView` (atau sibling `StudentSearchStep`), beri `id` stabil pada input search, implementasikan fokus kembali saat `Ubah Kata Kunci`, dan verifikasi alur klik: Batal tetap di Step 1 query utuh, Ubah fokus ke input, Buat masuk form + prefill.

## 3. Regression dan quality gates

- [x] 3.1 Tambah/ubah test regresi portal (search kosong -> dialog, confirm -> form + prefill, cancel/edit -> tetap search; search ketemu tidak membuka dialog) dan verifikasi dengan `bun test` / `npm run test` pada file terkait.
- [x] 3.2 Jalankan `npm run type-check`, `npm run lint`, `npm run build`, dan `bun run check:file-size`, verifikasi semuanya lolos sebelum lapor selesai.
