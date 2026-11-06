## Ringkasan Perubahan

Pull request ini mengimplementasikan penyelesaian atas masukan pengguna terkait pengalaman operasional logistik buku dan seragam:

1. **Fix Inbound Receiving PO Susulan**: Modal penerimaan supplier kini memiliki batas `max-h-[90vh] flex flex-col` dengan list item yang dapat di-scroll vertikal dan tombol *"Konfirmasi Masuk Stok Satuan"* & *"Batal"* selalu berada di sticky footer bawah (tidak lagi terdorong keluar layar).
2. **Fix Dropdown Paket Surat Jalan Internal**: Menghapus `overflow-hidden` pembatas pada tabel paket pengiriman dan menyelaraskan modal surat jalan internal agar listbox pilihan paket mengambang bebas (`z-50`) tanpa terpotong batas modal.
3. **Penamaan Deskriptif Seragam & Transparansi BOM**:
   - Mengekstrak sub-komponen `UniformAssemblySubSection` untuk perakitan paket seragam.
   - Menyajikan kartu rincian isi paket (*BOM Komponen*: nama item, tipe, size, kuantitas per paket) serta ketersediaan stok bahan baku langsung di layar perakitan.
   - Form PO konveksi menampilkan nama lengkap deskriptif varian seragam (`+ {v.name} ({v.code})`).
4. **Perapian Sub-Navigasi Seragam & Gudang Buku**:
   - Mengonsolidasikan tab operasional buku yang berserakan di header atas (Katalog, Paket, Stok, PO, Kirim Cabang, Retur, Rekonsiliasi) menjadi **1 Tab Induk Kanonik "Gudang Buku"** (`BookWarehouseView`) untuk `central_admin` dan `warehouse_books_admin`.
   - Mengabstraksi komponen sub-navigasi pil kanonik `SegmentedSubNav` untuk Seragam dan Gudang Buku.
5. **Anti-Kambuh & Penguatan Gate**:
   - Memperluas skrip `check:no-silent-catch` agar memindai seluruh direktori UI komponen & view staf.
   - Menambahkan Mandat Anti-Kambuh §0.46 (Universal No-Silent-Catch) dan §0.47 (Segmented SubNav Kanonik & Reaktivitas View) di `AGENTS.md`.

## Verifikasi & Kualitas

- `bun run check:fast` — Lulus hijau (lint, tsc, import depth, api contract, file-size, no-any, clean artifacts, no-silent-catch).
- `bun test src/components/layout/ src/lib/staff-roles.test.ts src/components/procurement/ src/components/uniform/` — 17 passing tests, 0 fails.
- Pengujian isolasi sesi dan status tab navigasi terkunci di `staff-tabs.test.ts`.
