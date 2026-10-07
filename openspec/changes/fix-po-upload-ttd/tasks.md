## 1. Implementasi Pemicu Upload TTD

- [x] 1.1 Ganti elemen `<label>` pemicu upload pada `src/components/procurement/PoWorkflowActions.tsx` menjadi `<button type="button">` dengan handler `onClick={() => fileInputRef.current?.click()}` dan `disabled={isUploading}`.
- [x] 1.2 Pastikan styling visual, tactile feedback (`active:scale-[0.98]`), tooltip title, dan loading indicator animasi pulse tetap berjalan dengan benar.

## 2. Verifikasi dan Pengujian

- [x] 2.1 Jalankan type check (`bun run type-check`) dan lint (`npm run lint`) untuk memastikan nol error TypeScript dan ESLint.
- [x] 2.2 Jalankan automated test suite (`bun test`) untuk memastikan seluruh pengujian PO workflow dan procurement tetap lulus.
- [x] 2.3 Jalankan pemeriksaan ukuran berkas (`bun run check:file-size`) untuk memastikan file yang dimodifikasi mematuhi batas <400 baris sesuai panduan `AGENTS.md`.
