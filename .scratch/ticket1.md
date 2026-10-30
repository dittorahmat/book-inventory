## What to build

Membuat pesanan buku di portal publik langsung berstatus `paid` (Lunas) bila nominal alokasi transfer setara/lebih dari harga buku, `partial` (Cicilan) jika membayar sebagian, dan `scholarship_approved` bila memiliki bukti beasiswa valid. Bukti Pengambilan langsung aktif tanpa mewajibkan verifikasi gudang di muka.

## Acceptance criteria

- [ ] `derivePaymentStatus` menerima parameter `allocationAmount` dan menghasilkan status pembayaran rekonsiliasi yang benar (`paid`, `partial`, `unpaid`, `scholarship_approved`).
- [ ] Endpoint `/api/public/orders/submit` menyimpan `paidAmount` dan status sesuai alokasi bukti transfer/beasiswa.
- [ ] Notifikasi WA Bukti Pengambilan dan respons JSON mencerminkan status pembayaran aktual.
- [ ] Regression unit tests di `order-intake/validation.test.ts` dan `public-orders.test.ts` lulus.

## Blocked by

None (can start immediately)
