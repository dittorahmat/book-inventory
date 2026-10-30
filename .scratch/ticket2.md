## What to build

Memungkinkan admin cabang / gudang menyerahkan buku fisik (`/handover`) kepada murid/wali yang membawa Bukti Pengambilan valid untuk status pesanan `paid`, `partial`, maupun `scholarship_approved` tanpa ditolak HTTP 400. Sistem mencatat penyerahan dan mencetak Surat Jalan Serah Terima (`SJ-SERAH`) untuk kebutuhan rekonsiliasi fisik vs finansial.

## Acceptance criteria

- [ ] `handoverPackage` di `order-handover.ts` mengizinkan serah terima untuk status `paid`, `partial`, `scholarship_approved`, atau pesanan berdiskresi.
- [ ] Tabel dan tombol aksi di `StudentOrdersTable.tsx` menampilkan badge dan status kesiapan serah terima dengan tepat.
- [ ] Endpoint `POST /api/student-orders/:id/handover` berhasil menerbitkan nomor SJ-SERAH untuk pesanan partial/lunas.
- [ ] Regression tests di `student-orders.test.ts` dan `order-fulfilment.test.ts` lulus.

## Blocked by

- #243
