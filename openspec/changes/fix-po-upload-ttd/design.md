## Context

Lihat `proposal.md` untuk latar belakang permasalahan.
Komponen `PoWorkflowActions` (`src/components/procurement/PoWorkflowActions.tsx`) saat ini menggunakan elemen `<label>` yang terpisah dari `<input type="file" ref={fileInputRef} className="hidden" />` tanpa keterhubungan `htmlFor`/`id` atau pemicu klik. Ref `fileInputRef` sudah dideklarasikan di komponen (`useRef<HTMLInputElement>(null)`), namun belum dipanggil saat elemen UI diklik.

## Goals / Non-Goals

**Goals:**
- Mengubah elemen UI interaktif menjadi `<button type="button">` semantik yang mengeksekusi `fileInputRef.current?.click()` saat diklik pengguna.
- Memastikan tombol mendukung aksesibilitas keyboard (fokusable, aktivasi lewat Space/Enter).
- Menjaga state visual loading (`isUploading`, animasi icon pulse, teks "Mengunggah...") dan disable state saat proses unggah aktif.
- Menjaga kompatibilitas dengan batas baris modul (`AGENTS.md` <400 baris, saat ini file hanya 164 baris).

**Non-Goals:**
- Mengubah endpoint backend `/api/procurement/purchase-orders/:id/signed-doc` (sudah stabil dan teruji).
- Mengubah aturan validasi berkas (maks 10MB, mime types `image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
- Mengubah alur cetak dokumen atau alur pengiriman PO.

## Decisions

### 1. Menggunakan `<button type="button">` dengan imperative ref click
- **Pilihan**: Mengubah `<label>` menjadi `<button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>`.
- **Rasional**:
  - Tombol aksi di baris tabel procurement semuanya menggunakan elemen `<button>` dengan styling Tailwind yang konsisten (`active:scale-[0.98]`, `disabled:opacity-50`).
  - Menghindari isu HTML ID collision di mana banyak baris PO di tabel memerlukan `id` unik jika menggunakan pola `htmlFor`/`id`.
  - Aksesibel bagi screen reader dan pengguna keyboard tanpa konfigurasi tambahan.
- **Alternatif yang Dipertimbangkan**:
  - *Membungkus `<input>` di dalam `<label>`*: Memerlukan penyesuaian styling dan kadang menimbulkan masalah double event triggering pada beberapa browser jika ada klik di child element.
  - *Membuat dynamic id `po-upload-${po.id}`*: Bekerja secara native HTML namun menambah kompleksitas props ID yang tidak perlu dibanding ref click langsung.

### 2. Mempertahankan pembersihan nilai input setelah upload
- `fileInputRef.current.value = ""` tetap dipertahankan di blok `finally` agar jika user mengunggah berkas yang sama ulang setelah perbaikan, event `onChange` tetap terpicu.

## Risks / Trade-offs

- **[Risk]** Event bubbling atau accidental form submission jika `<button>` tidak diberi `type="button"`.
  - **Mitigasi**: Selalu pastikan atribut `type="button"` dipasang secara eksplisit pada tombol.
- **[Risk]** File input dialog dibuka ganda jika pengguna mengklik cepat (rapid click).
  - **Mitigasi**: State `disabled={isUploading}` mencegah eksekusi berulang saat proses transmisi berkas berlangsung.
