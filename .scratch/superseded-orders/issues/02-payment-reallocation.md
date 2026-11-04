# 02: Seam Realokasi Finansial & Beasiswa via payment-ledger

**What to build:**
Memperluas modul `payment-ledger` untuk memindahkan alokasi pembayaran (`payment_allocations`) dari pesanan berstatus `superseded` ke pesanan pengganti tanpa mengubah baris mutasi bank asli di `payment_receipts`, serta menangani penyesuaian status kurang bayar (`partial`), lebih bayar (Refund Pending), dan transfer dokumen beasiswa.

**Blocked by:** 01: Skema Status superseded & Seam Pelepasan Alokasi Stok Atomik

**Status:** ready-for-agent

- [ ] Fungsi kanonik `reallocatePaymentToOrder` di `payment-ledger` memindahkan alokasi dana secara aman.
- [ ] Pesanan pengganti dengan nominal lebih besar otomatis berstatus `partial`.
- [ ] Pesanan pengganti dengan nominal lebih kecil dibatasi alokasinya sebesar total harga pesanan (`paid`), dan sisa dana dicatat sebagai status pending refund.
- [ ] Pesanan beasiswa menyalin dokumen bukti dan mempertahankan `scholarship_approved`.
- [ ] Test regresi memastikan baris `payment_receipts` tidak dihapus atau terduplikasi.
