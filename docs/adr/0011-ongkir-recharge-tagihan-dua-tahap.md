# Ongkir di-recharge ke cabang dan tagihan berjalan dua tahap

Ongkir hanya berlaku untuk kirim-rumah: seluruh pembelian seragam dan pembelian buku satuan. Paket buku diambil di sekolah sehingga tidak ada ongkir. Gudang membayar kurir di muka, wali membayar ongkir ke cabang, sehingga ongkir wajib ikut ditagihkan kembali ke cabang — bukan diserap gudang dan bukan menjadi omzet.

Karena ongkir baru diketahui setelah gudang menimbang dan memilih kurir, tagihan cabang berjalan dua tahap: `open` saat order dibuat atau barang diserahkan (nilai barang saja), lalu `final` saat ongkir diinput. Hanya tagihan `final` yang masuk klaim periode.

## Considered Options

- Gudang menyerap ongkir vs recharge ke cabang (dipilih: recharge — gudang mengeluarkan uang untuk kurir, dan tanpa recharge setiap kiriman menjadi kerugian).
- Ongkir masuk omzet vs pass-through (dipilih: pass-through — ongkir bukan pendapatan; ADR-0009 tetap berlaku dan rekap penjualan tidak berubah).
- Tagihan satu tahap setelah ongkir diketahui vs dua tahap (dipilih: dua tahap — menunggu ongkir menunda penagihan barang tanpa alasan, sedangkan menagih ongkir sebelum diketahui mustahil).

## Consequences

Gerbang "Invoice WhatsApp hanya terbit setelah ongkir diinput" dipertahankan: ia menandai tepat kapan nominal final diketahui. Setelah ongkir masuk, status pembayaran order wajib dihitung ulang memakai total yang sudah termasuk ongkir — tanpa itu order tampil lunas padahal masih kurang. Tagihan yang menjadi `final` setelah klaim dikunci masuk periode berikutnya, mengikuti perilaku lock `uniform_claims` yang sudah ada. Agar tidak ada tagihan menggantung, wajib ada daftar kerja "menunggu ongkir" yang terlihat oleh gudang.
