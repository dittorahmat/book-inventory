## Ringkasan

<!-- Apa yang berubah dan mengapa. Tautkan issue/ADR bila ada. -->

## Perubahan perilaku

Refactor murni wajib kosong. Perubahan status code, aturan terima, field respons,
atau efek samping yang disengaja wajib dijelaskan di sini + test skenarionya.

- [ ] Tidak ada — refactor/perbaikan tanpa perubahan kontrak.
- [ ] Ada — jelaskan endpoint/status/aturan yang berubah, alasan, dan test yang
      mengunci perilaku baru:

<!--
Contoh: `POST /api/public/orders/submit` menolak alokasi > total tagihan dengan
400 (sebelumnya diterima); test: `public-orders.test.ts` "alokasi ...".
-->

## Verifikasi

- [ ] `bun run check:fast` hijau (gate file berubah, termasuk `check:dead` +
      `check:single-writer`).
- [ ] `bun run check:all` hijau sekali sebelum merge.
- [ ] Perubahan skema disertai `check:d1-drift` hijau.
