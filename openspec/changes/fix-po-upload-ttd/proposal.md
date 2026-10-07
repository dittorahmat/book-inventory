## Why

Pada tab Pengadaan PO, saat PO berstatus `printed` ("DICETAK — MENUNGGU BUKTI TTD"), tombol "Upload Bukti TTD" muncul di baris aksi tabel. Namun, ketika tombol tersebut diklik oleh pengguna, tidak terjadi respons apa pun dan dialog pemilihan berkas (file picker) dari browser/OS tidak pernah terbuka.

Masalah ini terjadi karena elemen UI menggunakan tag `<label>` tanpa asosiasi `htmlFor`/`id` ke elemen `<input type="file">` yang berada di luar elemen tersebut, serta tidak memiliki pemicu `onClick` ke `fileInputRef`. Akibatnya, alur pengadaan terhenti karena berkas bukti tanda tangan basah & cap tidak dapat diunggah, yang pada akhirnya memblokir pengiriman PO ke supplier.

## What Changes

- **Pemicu Dialog Unggah Bukti TTD**: Mengubah elemen pemicu berkas di `src/components/procurement/PoWorkflowActions.tsx` agar menggunakan `<button type="button">` dengan event handler `onClick={() => fileInputRef.current?.click()}` (atau integrasi asosiasi form control yang semantik). Hal ini memastikan klik pada tombol membuka jendela dialog berkas sistem operasi (File Explorer).
- **Aksesibilitas & Feedback Pengguna**: Memastikan tombol dapat diakses melalui keyboard (Enter/Space), memiliki atribut `disabled` saat proses upload sedang berlangsung (`isUploading`), dan menjaga umpan balik visual (loading pulse / pesan status) tetap informatif.
- **Konsistensi Alur Workflow**: Memastikan bahwa setelah berkas berhasil dipilih dan diunggah, data PO dimuat ulang (`onChanged()`), status beralih ke `signed_uploaded`, dan tombol "Kirim PO" dapat diaktifkan sesuai validasi alur pengadaan.

## Capabilities

### New Capabilities
- `po-signed-doc-upload-trigger`: Pemicu antarmuka unggah dokumen bukti tanda tangan basah & cap pada purchase order yang responsif dan terhubung langsung ke file picker.

### Modified Capabilities
<!-- None -->

## Impact

- **Affected Code**: `src/components/procurement/PoWorkflowActions.tsx` (komponen aksi workflow PO).
- **APIs & Database**: Tidak ada perubahan endpoint backend (`/api/procurement/purchase-orders/:id/signed-doc` sudah ada dan berfungsi normal) maupun perubahan skema database Drizzle.
- **Dependencies**: Tidak ada dependensi baru; menggunakan React hooks dan Lucide icons yang sudah ada.
