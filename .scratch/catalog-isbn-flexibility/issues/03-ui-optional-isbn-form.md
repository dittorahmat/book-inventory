# 03: Penyesuaian Form Input Pendaftaran Katalog Buku di Frontend

**What to build:**
Pada komponen form pendaftaran buku `CreateBookForm.tsx`, input ISBN diubah menjadi opsional: label diperjelas menjadi "Nomor ISBN / Kode Buku (Opsional)", atribut `required` dicabut, placeholder disesuaikan menjadi panduan fleksibel, dan form dapat disubmit meski field ISBN kosong.

**Blocked by:** 02-relax-isbn-requirement

**Status:** ready-for-agent

- [ ] Input ISBN di `src/components/catalog/CreateBookForm.tsx` tidak lagi memiliki atribut `required`
- [ ] Label dan placeholder merefleksikan bahwa ISBN atau kode internal bersifat opsional
- [ ] Form submission berhasil mengirimkan payload baik saat ISBN diisi maupun saat kosong
