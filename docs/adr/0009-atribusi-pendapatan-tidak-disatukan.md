# Atribusi pendapatan buku vs seragam tidak disatukan

Rekap penjualan buku (`reporting/sales*`) dan seragam (`uniform/report.ts`) berbagi kernel (`reporting/sales-kernel.ts`: `selectInChunks`, `escapeCsvCell`/`quoteCsvCell`, `toCsvInt`, `periodEndIso`) tetapi TIDAK disatukan di balik satu seam: atribusi omzet buku proporsional-BOM sedangkan seragam `unitPriceSnapshot`/campur, dan dialek CSV beda disengaja (koma vs titik-koma).

## Considered Options

- Satu seam rekap dengan adaptor sumber Buku|Seragam (ditolak: menyamakan `accrue` vs breakdown paket dan dialek CSV berisiko menggeser angka revenue tanpa owner finansial yang memvalidasi kesetaraan).
- Duplikasi kernel per modul (ditolak: chunk D1, escape CSV, dan batas periode sudah terbukti drift dua kali — C6 architecture-review 2026-10-16).
- Berbagi kernel, atribusi tetap terpisah (dipilih: `uniform/report.ts` leverage `sales-kernel`; perbedaan atribusi + CSV didokumentasikan di docstring kernel sebagai hasil audit, bukan drift).

## Consequences

Perubahan logika bagi (`selectInChunks`, escape CSV, `periodEndIso`) wajib lewat `sales-kernel` agar kedua rekap ikut. Perubahan atribusi (cara omzet dihitung/dipecah) tetap per modul dan wajib regression test angka di modulnya masing-masing. Review arsitektur berikutnya dilarang mengusulkan penyatuan seam rekap tanpa bukti kesetaraan angka dari kedua sisi.
