# 03: Penugasan Paket Cabang, Edit Komposisi BOM & Delete Paket Buku

**What to build:**
Pengguna staf Central Admin dapat menugaskan paket buku ke cabang sekolah tertentu (`book_package_schools`) sehingga komposisi kurikulum dapat berbeda antar cabang (misal paket Al-Wildan 1 berbeda dari Al-Wildan 4; paket tanpa cabang tetap universal). Admin juga dapat memperbarui informasi paket buku dan komposisi komponen bukunya (BOM) melalui modal edit di tampilan Paket Buku (`PackagesView`). Perubahan komponen BOM memicu rekalkulasi harga paket otomatis dan secara aman membongkar (*auto-unbundle*) bundel fisik yang belum terdistribusi kembali menjadi stok buku satuan lepas di rak via single-writer kanonik. Tombol delete paket dilindungi guard sehingga paket yang telah memiliki riwayat pesanan siswa atau eksemplar paket aktif dicegah dari penghapusan.

**Blocked by:** 02: Edit & Delete Buku Satuan dengan Guard Eksemplar Fisik & BOM

**Status:** ready-for-agent

- [ ] Skema tabel D1 `book_package_schools` (`package_id` ↔ `school_id`) terdaftar di schema Drizzle dengan relasi foreign key dan index yang tepat.
- [ ] Modal Edit Paket di `PackagesView` mendukung multi-select penugasan sekolah cabang (kosong = universal untuk seluruh sekolah, terisi = eksklusif untuk cabang tersebut).
- [ ] Modal Edit Paket mendukung penambahan, pengurangan, dan pengubahan kuantitas komponen buku (BOM).
- [ ] Mutasi edit BOM dieksekusi melalui single-writer kanonik `package-mutation.ts` yang menjalankan auto-unbundle bundel fisik belum terdistribusi dan rekalkulasi harga paket.
- [ ] Tombol Delete Paket memvalidasi ketiadaan pesanan siswa (`student_book_orders`) dan ketiadaan eksemplar fisik paket (`package_items`): menolak penghapusan bila ada riwayat terkait.
- [ ] Automated tests memverifikasi integritas relasi cabang paket, auto-unbundle, dan guard penghapusan.
