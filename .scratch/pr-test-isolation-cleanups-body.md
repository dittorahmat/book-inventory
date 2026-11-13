## Ringkasan Perubahan
Memperbaiki kegagalan pengujian pada GitHub Actions CI (job `131671535778` pada run `43360178096`) yang disebabkan oleh pencemaran database pengujian akibat operasi `db.delete(bookPackages)`, `db.delete(books)`, dan `db.delete(schools)` tanpa klausa `WHERE` pada suite pengujian tertentu.

### Perubahan Perilaku & Perbaikan:
1. **Isolasi Fixture Pengujian (#454)**:
   - Menghapus operasi `db.delete(...)` menyeluruh pada `afterEach` di:
     - `src/server/services/order-supersede.test.ts`
     - `src/server/services/stock/aggregate.test.ts`
     - `src/server/services/student-withdrawal.test.ts`
   - Membatasi seluruh penghapusan fixture hanya pada ID yang dibuat selama tes masing-masing menggunakan blok `try ... finally` dan `where(eq(...))`.
2. **Deterministik State Demo Seed (#455)**:
   - Pada `src/server/seed-demo/demo-uniform.ts`, menambahkan reset status antrean `ex-demo-01` ke `requested` sebelum seeding, mencegah kegagalan pengujian saat dijalankan setelah suite E2E yang me-resolve antrean seragam (`demo-part4.test.ts`).
3. **Pemeriksaan Anti-Kambuh Test Isolation (#456)**:
   - Menambahkan aturan B7 pada `scripts/check-test-isolation.ts` untuk memblokir pemanggilan `db.delete(<table>)` tanpa klausa `.where(...)` pada tabel master (`bookPackages`, `books`, `schools`, `students`, `uniformVariants`, dll).

Closes #454, closes #455, closes #456
