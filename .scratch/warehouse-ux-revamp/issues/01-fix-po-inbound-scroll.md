# 01: Fix Modal Scroll & Sticky Actions pada Penerimaan PO Susulan

**What to build:**
Modal "Penerimaan Barang Dari Supplier (Inbound)" memiliki batasan tinggi viewport responsif (`max-h-[90vh] flex flex-col`), body input penerimaan dapat di-scroll vertikal (`overflow-y-auto`) berapapun banyaknya riwayat SJ sebelumnya, dan tombol "Konfirmasi Penerimaan" & "Batal" selalu tampak di bagian bawah (sticky footer) tanpa terpotong atau terdorong ke luar layar.

**Blocked by:** None (can start immediately)

**Status:** in-progress

- [ ] Modal dialog memiliki pembatas `max-h-[90vh]` dan container `flex flex-col`
- [ ] Bagian form item dan riwayat penerimaan ditempatkan dalam container `flex-1 overflow-y-auto`
- [ ] Tombol aksi penerimaan dan batal berada di footer sticky di bagian bawah modal
