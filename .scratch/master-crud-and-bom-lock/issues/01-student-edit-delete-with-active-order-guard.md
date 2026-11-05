# 01: Edit & Delete Murid dengan Guard Status Pesanan Aktif

**What to build:**
Pengguna staf (Central Admin / Branch Admin) dapat memperbarui data profil murid (Nama, NIS, Gender, Data Kontak Ortu, Status Beasiswa, dan Status Akademik) melalui modal edit di tampilan Data Siswa. Kenaikan kelas atau pembaruan tahun ajaran diizinkan secara bebas kecuali jika murid memiliki pesanan buku/seragam aktif yang masih menggantung di tahun berjalan (belum diserahterimakan atau belum dikirim), dalam hal ini jenjang dan sekolah dikunci agar tidak merusak alokasi stok cabang. Tombol hapus hanya mengizinkan penghapusan murid bersih tanpa riwayat pesanan/transaksi; murid yang memiliki riwayat pesanan dicegah dari penghapusan permanen dan diarahkan untuk mengubah status menjadi graduated atau inactive.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Modal Edit Murid dapat dibuka dari baris data murid di tampilan Data Siswa (`StudentsView`), terisi nilai eksisting, dan menyimpan perubahan via endpoint `PUT /api/students/:id`.
- [ ] Pemeriksaan pesanan aktif: jika murid memiliki pesanan berstatus `waiting_preparation`, `ready_for_pickup`, atau seragam `belum_dikirim`, input pilihan Cabang Sekolah (`school_id`) dan Kelas (`grade_level`) dinonaktifkan dengan banner informasi yang jelas.
- [ ] Kenaikan kelas atau pergantian tahun ajaran dapat dilakukan secara normal bagi murid yang seluruh pesanannya telah berstatus selesai (`picked_up` / `sudah_dikirim`) atau belum memiliki pesanan sama sekali.
- [ ] Tombol Delete Murid mengecek keberadaan transaksi pesanan buku (`student_book_orders`) dan seragam (`uniform_orders`): jika ditemukan riwayat, hapus ditolak dengan pesan edukatif; jika murid bersih dari riwayat, hapus diproses dengan konfirmasi aman.
- [ ] Automated route & component test memastikan guard pesanan aktif berfungsi dan integritas data murid terjaga.
