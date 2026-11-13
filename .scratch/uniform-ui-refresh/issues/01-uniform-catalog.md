# 01: refactor(uniform-catalog): Tabel Desktop Responsif, Search Toolbar & Collapsible Stock Adjustments

**What to build:**
Mengubah tampilan daftar varian seragam menjadi tabel desktop berkolom yang rapi (dengan fallback kartu pada mobile) yang dilengkapi search bar terpadu, serta merapikan formulir "Stok Manual" dan "Catat Reject" menjadi collapsible section/tab agar tidak menggelar card besar permanen yang memenuhi halaman.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Daftar varian seragam menampilkan format tabel desktop (`hidden md:block`) dengan kolom Kode, Nama, Jenis, Jenjang/Gender, Ukuran, Harga Satuan, Rincian Stok, dan Aksi.
- [ ] Tersedia fallback tampilan kartu ringkas untuk mobile (`md:hidden`).
- [ ] Toolbar memiliki input pencarian instan (search) dan badge penghitung varian terdaftar.
- [ ] Blok form "Stok Manual" dan "Catat Reject" ditata rapi dalam panel sekunder/collapsible drawer sehingga tidak memakan ruang daftar utama saat tidak dipakai.
- [ ] Menjaga seluruh fungsi operasional (adjust stock, catat reject, edit varian) tetap berfungsi normal dengan validasi yang benar.
