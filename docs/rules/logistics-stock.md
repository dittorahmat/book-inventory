# Aturan Gudang & Logistik

Dokumen ini memuat aturan kanonik dan mandat anti-kambuh untuk alur logistik seragam, pengiriman transfer buku, alokasi stok FIFO, scoping cabang gudang, dan rekonsiliasi akhir periode.

---

## Mandat Anti-Kambuh

### §0.7. Stok Seragam & Single-Writer
Semua mutasi stok seragam wajib lewat `uniform/stock` (`check:single-writer`), dengan kebijakan `require`/`create`/`skip` eksplisit.

### §0.9. Lokasi & Branch Roaming Gudang
Header (`AppHeader.tsx`) tetap merupakan badge identitas murni tanpa mutasi global lokasi transaksi; pemilihan cabang untuk role gudang/logistik dilakukan di tingkat view/tab transaksi spesifik (filter view, form pengiriman, dan selector query), bukan menimpa state penugasan akun.

### §0.15. Seam Alokasi Stok Terpadu
Alokasi fisik berbasis FIFO (`allocateInventoryStock` di `src/server/services/stock/allocation.ts`) adalah titik masuk tunggal untuk unit satuan maupun bundel paket; hindari percabangan pemanggil langsung ke implementasi tabel terpisah.

### §0.16. Otoritas Server pada Audit Rekonsiliasi
Alur Berita Acara / Rekonsiliasi akhir periode (`term-reconciliation`) wajib server-authoritative; input fisik dapat disubmit mandiri tanpa mewajibkan kalkulasi delta atau penarikan ulang angka inbound di sisi klien.

### §0.20. Kontrak Status & Skema Transfer Logistics
Status seragam kanonik pada level backend adalah `sudah_dikirim` (bilingual guard: hindari inferensi enum bahasa Inggris `shipped` pada seragam); transfer buku internal (`/api/shipments`) menghasilkan nomor dokumen berprefix `TRF-*` (`shipmentNumber`), dan payload draft items wajib menyertakan discriminator `{ itemType: "loose" | "package", ... }`.

### §0.39. Dekomposisi Sub-Router & Pemisahan Komponen Rekonsiliasi
Route publik yang memuat intake komplain/retur wajib didelegasikan ke sub-router fungsional (`public-order-returns.ts`); tampilan Berita Acara / audit rekonsiliasi akhir periode wajib memisahkan state/mutasi ke custom hook (`useTermReconciliation.ts`) dan tabel audit ke sub-komponen (`AuditCountsTable.tsx`) agar view orchestrator tetap ramping (<200 baris) dan mematuhi gate file-size §7. Objek agregat audit rekonsiliasi wajib diikat ke tipe terstruktur terpadu (`AuditTotals`) guna mencegah bau kode *data clumps*.

### §0.44. Disiplin Scoping Global & Anti-Locking Lokasi pada View Transaksi (ADR-0020)
Role global (`central_admin` dan seluruh role logistik/gudang `LOGISTICS_ROLES`) berhak melihat pesanan dan transaksi seluruh cabang secara terpusat (*cross-branch roaming*):
1. Pada level backend router (`/api/student-orders`, `/api/uniforms/orders`), jika `c.req.query("schoolId")` kosong, filter partisi sekolah dilarang dipaksa menyempit ke cabang tunggal (`!isGlobal && scope.length === 1`), agar instalasi dengan 1 cabang atau database baru tidak mendegradasi query global menjadi scoped query secara sepihak.
2. Pada level UI view (`StudentOrdersView.tsx`, `UniformView.tsx`, `UniformShipmentSection.tsx`), role global wajib mengaktifkan opsi `"Semua Cabang"` sebagai default view dengan `lockedSchoolId: null`, dan pemilihan cabang dilakukan mandiri di filter tingkat transaksi/view tanpa membatasi roaming akun atau menimpa penugasan identitas global.
3. Seluruh test suite yang menguji pemanggilan fetch atau custom hook data-fetching wajib menggunakan pengetikan struktural (`typeof fetch` / `unknown` narrowing), dilarang menggunakan type assertion `as any` (§check:no-any).
4. Saat membuka worktree baru (`git worktree add`), gunakan script otomatisasi `bun run worktree:create <branch>` untuk memastikan junction dependency `node_modules` terhubung otomatis di Windows pwsh tanpa memicu kegagalan import modul. Pada pemisahan lokasi (`src/lib/location-helpers.ts`), lokasi bertipe `warehouse` dilarang diperlakukan sebagai cabang sekolah murid aktif (`isWarehouseLocation(school)` wajib memicu fallback filter view `"all"`).
5. Pada seluruh modal intake murid (`StudentFormModal`, `StudentBulkUploadModal`, `BatchPromoteModal`), daftar pilihan sekolah wajib disaring dengan `filterBranchSchools` agar entitas gudang logistik tidak dapat dipilih sebagai sekolah murid.
6. State filter lokasi view transaksi (`selectedSchoolId`) hanya diinisialisasi sekali dari helper kanonik saat mount; dilarang memasang `useEffect` yang menimpa ulang `selectedSchoolId` pada setiap render/prop reference update agar pilihan cabang manual pengguna tidak ter-reset secara tidak sengaja di tengah sesi.

### §0.52. Disiplin Seam Impor Masal & Netralitas Utility Spreadsheet
1. **Seam Layanan Impor Masal Katalog Buku**: operasi impor masal buku (`/api/books/bulk-import`) wajib didelegasikan ke modul domain service kanonik (`src/server/services/book-catalog-import.ts`), dilarang mengeksekusi perulangan query SQL/Drizzle satu per satu di handler router (§0.27); kueri pencarian eksisting dan batch insert wajib dikelompokkan dalam chunk aman (`chunkRows` dari `src/server/lib/d1-write.ts`).
2. **Kanonikalisasi Parser Katalog Seragam & Single-Writer Stok**: skrip maupun seam pengolahan bulk import katalog seragam (`scripts/import-uniform-catalog.ts`) wajib:
   - Memakai parser terisolasi (`parseCatalogWorkbook`) untuk memetakan jenjang dan gender secara deterministik tanpa primitive obsession.
   - Mengelompokkan penyisipan entitas (`uniform_variants`, `uniform_sizes`) dalam chunking aman D1 maksimal 10 baris (§10.1).
   - Menginisialisasi saldo stok seragam secara eksklusif lewat seam kanonik single-writer `setVariantStockQuery` (§0.7), dilarang melakukan raw insert mentah ke tabel `uniform_stock`.
   - Mengaitkan size chart URL secara konsisten ke seluruh varian yang relevan dan menyajikan file gambar statis di direktori aset publik aplikasi (`public/`).
2. **Pemisahan Utility Netral Spreadsheet**: helper tautan Google Sheets atau parser spreadsheet bersama (`normalizeGoogleSheetsUrl` dsb.) wajib berada di modul utilitas bersama yang netral (`src/lib/sheets.ts`), dilarang diimpor lintas domain entitas (misal mengimpor helper URL Google Sheets dari parser siswa ke modal buku) guna mencegah bau kode *Feature Envy / Inappropriate Intimacy*.
3. **Disiplin Kebersihan Artefak Migrasi & Skrip Generator Ad-hoc**: dilarang melakukan commit atas berkas generator dump SQL sementara (`scripts/export-*-sql.ts`, `drizzle/students-d1.sql`, dsb.) ke dalam tree git; skrip pembersihan (`scripts/purge-d1.ts`) wajib mempertahankan pengetikan fail-closed (`catch (e: unknown)`) tanpa menggunakan tipe `any`.
4. **Penegakan Mekanis Anti-Loop Mutasi Router**: gate `check:d1-writes` memvalidasi aturan R3 (menolak loop `for`/`for-of` di file rute yang mengeksekusi mutasi Drizzle per baris) agar seluruh mutasi masal selalu didelegasikan ke service seam ter-chunk. Eksekusi remote D1 dilarang memanggil subprocess python atau shell ad-hoc; gunakan runner resmi `bun scripts/d1-remote.ts --command="..."` atau `--file="..."`.

### §0.56. Integritas Metrik Deduplikasi & Pemisahan Baris Cacat (Anti-Conflation)
1. **Pemisahan Baris Cacat vs Baris Duplikat**: kalkulasi counter data unik vs duplikat pada pratinjau import masal (katalog buku, data murid, dsb.) dilarang mencampurkan baris tidak valid / dilewati (`skippedRows`) ke dalam hitungan baris duplikat; metrik deduplikasi wajib memusat ke helper kanonik `calculateDedupMetrics` (`src/lib/intake-dedup.ts`) dengan rumus `max(0, rawReadCount - (uniqueCount + skippedInvalidCount))`. Ditegakkan mekanis oleh gate `check:canonical-helpers`.
2. **Konsistensi Akumulasi Baris Mentah Batch Runner**: penghitungan akumulasi baris mentah (`totalRawRead`) saat memproses berkas masal di modal intake wajib konsisten antara mode berkas tunggal dan folder batch (keduanya memperhitungkan `validItems.length + skippedRows.length`). Komponen `DriveFolderBatchRunner` wajib mengekspos prop `rawItemsCount` secara eksplisit dan memprioritaskannya di atas akumulasi internal bila disediakan.
3. **Disiplin Uji Batas Komponen Preview**: setiap unit test komponen pratinjau import (`BookImportPreview`, `StudentImportPreview`) wajib memuat skenario uji dengan `skippedRows > 0` untuk memvalidasi bahwa baris cacat tidak bocor ke badge notifikasi duplikat. Rincian domain tersimpan di `docs/agents/rules-intake.md`.
4. **Otorisasi & Atomisitas Mutasi Master Paket Buku (BOM)**:
   - Master paket buku bersifat global tanpa `school_id`; mutasi master paket (`POST`, `PUT`, `DELETE` di `/api/packages`) wajib dilindungi secara ketat oleh `resolveBookLogisticsActor` (`central_admin`, `warehouse_admin`, `warehouse_books_admin`). Role cabang atau admin seragam dilarang memutasi master paket buku.
   - Di UI frontend (`PackagesView`, `PackageCard`), aksi edit dan buat paket wajib disaring oleh predikat `isBookWarehouseStaffRole(userRole)`.
   - Mutasi update/delete paket wajib didelegasikan ke domain service kanonik (`src/server/services/package-mutation.ts`) sebagai deep module atomik yang membongkar bundel fisik aktif (`unbundleAllActiveBundles`) sebelum memperbarui BOM dan menghitung ulang harga paket secara otomatis via `recalcPackagePrice`. Dilarang mengeksekusi multiple unbatched SQL queries di handler router.
5. **Dekomposisi Sub-Navigasi Tab Gudang Seragam & Isolasi Domain Supplier (Anti-Cluttering)**:
   - Sub-tab di `UniformView` memisahkan secara modular: `Katalog Seragam` (`UniformCatalogSection`), `Paket & Rakit Seragam` (`UniformAssemblySection`), dan `PO Konveksi` (`UniformProcurementSection`), eksklusif untuk peran logistik (`isLogisticsRole`).
   - Form perakitan paket seragam mandiri wajib menyediakan input tahun ajaran (`academicYear`) tanpa bergantung pada state eksternal atau default statis tak terganti.
   - Domain supplier buku (penerbit) dan supplier seragam (mitra konveksi) wajib dipartisi secara eksplisit pada skema database (`suppliers.type`: `'book' | 'uniform' | 'all'`) dan disaring pada endpoint API (`/api/procurement/suppliers?type=...`); form pengadaan seragam dilarang mencampurkan dropdown vendor buku dan wajib menyediakan modal pendaftaran konveksi langsung (`defaultType: 'uniform'`).
   - Setiap pemisahan sub-tab wajib disertai pengujian unit peralihan sub-tab (`UniformView.test.tsx`) yang mencakup seluruh tab aktif.

### §0.61. Penyesuaian Stok Cacat/Rusak pada Intake PO & Transfer (Audit-Only Balance Guard)
1. **Pencatatan Cacat Saat Inbound Penerbit (PO)**: barang yang diterima dalam kondisi rusak dari supplier belum pernah masuk ke saldo persediaan tersedia (`availableQuantity`). Pencatatan penyesuaian stok di `stock_adjustments` wajib menggunakan opsi `updateStockBalance: false`, dilarang memotong saldo aktif secara negatif.
2. **Selisih Transit Antarcabang**: barang rusak atau hilang yang terjadi selama transit pengiriman antar-sekolah dicatat sebagai audit log pada cabang penerima tanpa memotong saldo aktif cabang penerima yang belum pernah menerima unit fisik tersebut.

### §0.62. Deep Module Engine Mutasi Inventaris Agregat (`moveInventoryStock`)
1. **Titik Masuk Tunggal Mutasi Stok Agregat**: Seluruh operasi pergerakan stok agregat (`receipt`, `handover`, `transfer`, `transfer_discrepancy`, `assembly`, `disassembly`, `adjustment`) wajib melalui engine `moveInventoryStock` (`src/server/services/stock/movement.ts`). Dilarang memanggil `adjustLooseStock`, `adjustPackageStock`, atau `recordStockAdjustment` secara langsung di router atau orchestrator lain.
2. **Anti-Feature-Envy pada Selisih Pengiriman**: Penanganan selisih pengiriman transfer (`damaged` / `missing`) wajib menggunakan tipe mutasi native `transfer_discrepancy`. Dilarang menduplikasi orkestrasi berurutan (`handover` debit asal + `adjustment` audit tujuan) di pemanggil; engine bertanggung jawab penuh atas debit asal dan pencatatan audit di tujuan secara atomik.
3. **Penyatuan Lifecycle Paket & Pembatalan**: Operasi kitting/unbundling dan modifikasi BOM buku memusat pada deep module `src/server/services/package/index.ts`. Alur pembatalan/pengunduran diri murid (`order-withdrawal`) memusat pada `src/server/services/order-withdrawal/index.ts` untuk buku dan seragam.
