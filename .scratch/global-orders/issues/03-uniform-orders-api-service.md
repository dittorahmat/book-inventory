# 03: Global Uniform Orders Query & Search Unification (API & Service)

**What to build:**
Mengizinkan pengambilan dan pencarian data order seragam `/api/uniforms/orders` tanpa batasan wajib `schoolId` khusus untuk Central Admin dan Admin Gudang Seragam (`isCentralRole` atau `isUniformStaffRole`). Menyertakan `schoolName` pada payload baris order.

**Blocked by:** None (can start immediately / parallel)

**Status:** ready-for-agent

- [ ] `/api/uniforms/orders` mengizinkan query tanpa `schoolId` bagi admin global
- [ ] Pencarian keyword (`search`) tanpa `schoolId` diizinkan khusus untuk admin global (menghapus blokir error 400 "Pencarian wajib disertai filter sekolah" untuk admin global)
- [ ] Baris order seragam menyertakan `schoolName`
- [ ] Unit regression test di `uniforms.test.ts` terverifikasi
