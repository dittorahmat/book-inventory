# 03: refactor(uniform-procurement): Header Editorial, Form Search, & Tabel Inbound PO Konveksi

**What to build:**
Menyelaraskan modul PO Konveksi agar berstandar enterprise seperti ProcurementView Gudang Buku: memiliki header editorial, form search untuk memfilter nomor PO / mitra konveksi / barang, tombol tambah PO yang membuka modal terdedikasi, serta tabel status PO inbound yang terstruktur menggantikan form mentah yang bertumpuk.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Header editorial rapi dengan deskripsi dan aksi cepat "+ Mitra Konveksi" dan "+ Buat PO Konveksi Baru".
- [ ] Tersedia form search untuk mencari PO berdasarkan nomor PO, nama vendor konveksi, atau item.
- [ ] Pembuatan PO dipindahkan ke modal/drawer bersih alih-alih form masif yang selalu menempel di atas daftar.
- [ ] Daftar PO ditampilkan dalam tabel rapi berkolom dengan badge status yang jelas (Draft, Dipesan, Diterima Sebagian, Selesai).
- [ ] Alur penerimaan barang PO (inbound receiving) tetap intuitif dan terintegrasi.
