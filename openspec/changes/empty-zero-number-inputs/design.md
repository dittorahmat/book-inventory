## Context

Lihat `proposal.md` untuk motivasi dan `specs/numeric-input-empty-zero/spec.md` untuk kontrak perilaku.
Di berbagai file React (`.tsx`), elemen `<input type="number" ... />` menerima props `value={val}` di mana `val` bernilai default `0`. Ketika user mengklik dan mengetik, browser menggabungkan karakter baru setelah angka `0`, menghasilkan string seperti `0150000`.

## Goals / Non-Goals

**Goals:**
- Mengubah perilaku rendering nilai input bertipe angka agar menampilkan `""` (string kosong) saat state bernilai `0`, sehingga placeholder `"0"` tampil bersih tanpa angka `0` fisik.
- Memastikan `onChange` pada setiap input angka secara andal mem-parse input kosong menjadi `0` (`Math.max(0, parseInt(e.target.value, 10) || 0)` atau `Number(e.target.value) || 0`).
- Memastikan konsistensi di seluruh 10 file komponen dan view yang memiliki input angka.

**Non-Goals:**
- Membuat komponen mask mata uang kompleks dengan format titik ribuan (`Rp 150.000`) pada tahap ini (ditolak sesuai konfirmasi pengguna).
- Mengubah tipe data di state frontend atau backend D1/SQLite (nilai tersimpan tetap integer `number`).

## Decisions

### 1. Pola Tampilan Nilai Kosong saat Nol (`val === 0 ? "" : val`)
- **Pilihan**: Menggunakan conditional `value={val === 0 ? "" : val}` dengan `placeholder="0"` (atau placeholder kontekstual yang sudah ada).
- **Rasional**: Pendekatan ini adalah standar React idomatis untuk input terikat angka di mana angka nol tidak perlu menghalangi pengisian data baru.
- **Alternatif yang ditolak**:
  - *Auto-select saat focus (`onFocus={(e) => e.target.select()}`)*: Masih menyisakan angka `0` jika user klik di posisi kursor tertentu di perangkat sentuh/mobile.
  - *Menyimpan state sebagai string di seluruh komponen*: Mengakibatkan perubahan tipe data masif di seluruh aplikasi dan rawan bug konversi tipe.

### 2. Standarisasi Handler Input Kosong
- **Pilihan**: Memastikan parsing `e.target.value` menggunakan fallback `|| 0` (misal `parseInt(e.target.value, 10) || 0` atau `Number(e.target.value) || 0`).
- **Rasional**: Saat user menekan backspace hingga bersih, `e.target.value` bernilai string kosong `""`. Fallback `|| 0` memastikan state tidak menjadi `NaN` dan langsung kembali ke `0`, merender placeholder `"0"`.

## Risks / Trade-offs

- **[Field yang mengizinkan angka 0 sebagai nilai sah yang disengaja]** → Placeholder `"0"` tetap memberikan feedback visual bahwa nilainya adalah 0 secara default, sehingga user mengerti bahwa membiarkan kolom kosong sama artinya dengan nilai 0.
- **[Input dengan batas minimum atau step tertentu]** → Input seperti diskon (`min={0} max={100}`) atau harga (`step={1000}`) tetap mempertahankan props validasi HTML5 aslinya.
