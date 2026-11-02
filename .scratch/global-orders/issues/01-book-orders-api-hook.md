# 01: Global Order Scoping & Filtering for Book Orders (API & Hook)

**What to build:**
Mengizinkan pengambilan data pesanan buku siswa `/api/student-orders` tanpa parameter `schoolId` bagi Central Admin dan Warehouse/Logistics Admin, mengembalikan pesanan dari seluruh cabang yang dilengkapi informasi `schoolName`, serta memperbarui hook `useStudentOrders` agar tidak early-return dan mendukung filter `schoolId` opsional.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `/api/student-orders` mengembalikan data seluruh cabang saat diakses central/warehouse admin tanpa `schoolId` query
- [ ] Baris pesanan mengembalikan `schoolName` (join ke tabel schools)
- [ ] `useStudentOrders` tidak melakukan `if (!schoolId) return;` bagi query global
- [ ] Unit & regression tests di `student-orders.test.ts` dan hook test hijau
