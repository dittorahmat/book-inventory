## Context

Aplikasi saat ini menggunakan Tailwind CSS, React, dan Lucide Icons. Layout desktop berbasis container max-width 6xl dengan bilah header atas tetap dan tabel data tradisional. Pada layar kecil (< 768px), elemen-elemen ini membutuhkan penyesuaian visual untuk pengalaman pengguna smartphone tanpa merusak kenyamanan layout desktop yang sudah ada.

## Goals / Non-Goals

**Goals:**
- Mengimplementasikan `MobileNavBar` tetap di bagian bawah layar smartphone (< 768px) yang ergonomis untuk navigasi jempol.
- Membuat komponen kartu responsif (`InventoryCard`, `TransferCard`, `CatalogCard`) yang otomatis tampil menggantikan tag `<table>` saat viewport sempit.
- Memastikan touch targets berukuran minimal 44x44px untuk kontrol interaktif (checkbox, tombol transfer, status audit).
- Mengintegrasikan safe area padding (`pb-20` atau `env(safe-area-inset-bottom)`) agar konten utama dan floating action bar tidak tertutup navigasi bawah.

**Non-Goals:**
- Mengubah arsitektur API atau model data backend (semua kontrak API tetap sama).
- Membuat aplikasi mobile native terpisah (misal React Native) — solusi tetap berupa Responsive Web App (PWA-ready).

## Decisions

1. **Bottom Navigation Bar vs Drawer Navigation**:
   - *Keputusan*: Menggunakan Bottom Navigation Bar tetap di mobile (`fixed bottom-0 left-0 right-0 z-30 md:hidden`).
   - *Alasan*: Pola thumb-friendly standar untuk smartphone Android memudahkan pergantian tab hanya dengan satu tangan.
   - *Alternatif dipertimbangkan*: Hamburger drawer di kiri atas, namun membutuhkan 2 kali tap dan sulit dijangkau jempol.

2. **Adaptive Card View vs Horizontal Scrolling Table**:
   - *Keputusan*: Menggunakan tumpukan Card (`md:hidden block space-y-3`) bersanding dengan tabel desktop (`hidden md:table`).
   - *Alasan*: Tabel dengan 7 kolom sulit dibaca di layar 360-400px meskipun diberi horizontal scroll. Format card memberikan hierarki visual yang jelas untuk judul, barcode, dan kondisi buku.

3. **Floating Batch Actions Positioning**:
   - *Keputusan*: Menaikkan posisi floating action bar (untuk batch transfer) pada mobile menjadi `bottom-16` agar tidak tumpang tindih dengan Bottom Navigation Bar.
   - *Alasan*: Mencegah tombol navigasi terhalang dan meminimalisir salah tekan.

## Risks / Trade-offs

- [Duplikasi struktur visual Card vs Table di JSX] → Komponen item card di-modularisasi agar logika pemanggilan aksi (misal update kondisi) tetap satu sumber kebenaran.
- [Virtual keyboard Android menutupi form modal] → Modal menggunakan `max-h-[90vh] overflow-y-auto` dengan centering flexbox adaptif.
