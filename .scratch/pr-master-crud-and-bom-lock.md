## Ringkasan Perubahan

Pull request ini mengimplementasikan fitur Edit & Delete untuk seluruh data master (murid, buku, seragam, paket buku, dan paket seragam) dengan guard dependensi stok & pesanan aktif, pembatasan pemilihan buku satuan hanya dari BOM paket murid yang ditugaskan (dengan whitelist override per sekolah & jenjang), serta penugasan paket buku ke cabang sekolah tertentu.

---

### Perubahan Perilaku

1. **Master Murid (`src/server/services/student-lifecycle.ts`, `src/components/students/`)**:
   - Menambahkan guard pesanan aktif pada saat edit dan delete siswa.
   - Jika siswa memiliki pesanan buku (`student_book_orders`) berstatus non-`picked_up` atau pesanan seragam (`uniform_orders`) berstatus `belum_dikirim`, perubahan sekolah/jenjang kelas serta penghapusan siswa ditolak dengan pesan informatif mencantumkan nomor pesanan yang belum selesai.
   - Menyediakan modal edit siswa `StudentFormModal` dengan integrasi tombol hapus ber-guard konfirmasi.

2. **Master Buku (`src/server/routes/books.ts`, `src/components/catalog/`)**:
   - Menambahkan modal edit buku `EditBookModal` di `CatalogView` dan `CatalogBookList`.
   - Menolak penghapusan buku jika terdapat eksemplar fisik di gudang/cabang (`book_items`), komponen dalam paket (`book_package_items`), atau dokumen PO (`purchase_order_items`).
   - Tombol aksi edit & hapus buku diproteksi predikat peran kanonik (`canManageCatalog = !userRole || isCentralRole(userRole) || isBookWarehouseStaffRole(userRole)`).

3. **Paket Buku Khusus Cabang & BOM Edit (`src/server/services/package-mutation.ts`, `src/components/packages/`)**:
   - Menambahkan tabel junction `book_package_schools`. Paket buku dapat ditugaskan ke cabang sekolah tertentu (jika kosong = paket universal untuk semua cabang).
   - Menyediakan modal edit paket buku `EditPackageModal` dengan multi-select cabang sekolah dan pengubahan kuantitas/komposisi item BOM.
   - Guard hapus paket: auto-unbundle bundel fisik ready ke stok satuan lepas, dan menolak penghapusan jika paket memiliki pesanan siswa aktif atau bundel fisik yang pernah terdistribusi (`dispatched`/`delivered`).

4. **Katalog Satuan Terkunci BOM & Override Whitelist (`src/server/services/order-intake/cutoff.ts`, `src/components/settings/`)**:
   - Menambahkan tabel `school_grade_allowed_books`.
   - Endpoint portal publik `/api/public/orders/satuan-catalog` memfilter buku hanya dari BOM paket yang berlaku untuk jenjang/sekolah siswa ditambah item whitelist override cabang.
   - Menyediakan antarmuka manajemen whitelist buku satuan `SchoolGradeAllowedBooksSettings` di tab *Cut-off Satuan* halaman Settings.

5. **Master Varian Seragam & Paket Seragam (`src/server/services/uniform/`, `src/components/uniform/`)**:
   - Endpoint `PUT /api/uniforms/variants/:id`, `DELETE /api/uniforms/variants/:id`, `PUT /api/uniforms/packages/:id`, dan `DELETE /api/uniforms/packages/:id`.
   - Modal UI `EditUniformVariantModal` di `UniformCatalogSection` dan `EditUniformPackageModal` di `UniformAssemblySection`.
   - Guard pengurangan ukuran varian & hapus varian: menolak mutasi jika ukuran memiliki saldo stok gudang (`uniform_stock > 0`) atau terikat pesanan pending (`uniform_orders`).
   - Guard hapus paket seragam: menolak jika terdapat stok bundel rakitan siap kirim (`readyQty > 0`) atau riwayat order (`uniform_order_items`).
   - Cascade delete entitas relasi anak seragam dieksekusi secara atomik via `runWriteBatch`.

6. **Tooling & Aturan Anti-Kambuh**:
   - `scripts/check-file-size.ts` kini mendukung pengecekan file tunggal via argumen CLI `bun scripts/check-file-size.ts <path>`.
   - Pembaruan aturan navigasi dan checklist UI di `AGENTS.md` dan `CODING_STANDARDS.md` §3.
   - Sinkronisasi skema migrasi remote D1 (`0043_unique_warhawk.sql` dan `0044_easy_marvex.sql`) diverifikasi lolos `bun run check:d1-drift`.

---

### Verifikasi Kualitas
- `bun run check:all` **HIJAU** (715 test passing, 0 fail, 0 type error, 0 lint error, file size <= 400 lines).
- `bun run check:d1-drift` **HIJAU** (51/51 tabel remote tersinkronisasi).
- Sumbu *Standards* dan *Spec* dari `/code-review` tervalidasi dan telah diperbaiki.
