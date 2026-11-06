# 05: Consolidate Package BOM Mutation, Assembly & Dynamic WPR

**What to build:**
Menyatukan manajemen siklus hidup paket buku ke dalam modul `src/server/services/package/`.

**Blocked by:** 02-migrate-stock-mutation-call-sites

**Status:** ready-for-agent

- [ ] Modul `src/server/services/package/index.ts`
- [ ] Enkapsulasi kitting/assembly, auto-unbundle saat edit BOM, injeksi WPR, dan rekalkulasi harga
- [ ] Rute `packages.ts` memanggil modul terpadu
- [ ] Test terpadu siklus hidup paket
