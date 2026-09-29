## Context

Lihat `proposal.md` (Why) untuk motivasi. Kondisi kini: `usePublicOrder.handleSearch` (`src/components/portal/usePublicOrder.ts`) melakukan `setIsNewStudentMode(true)` + prefill `newStudent.name` segera saat `searchStudents` mengembalikan array kosong. `StudentSearchStep.tsx` merender form pencarian vs form murid baru berdasarkan `isNewStudentMode`, dan `PublicOrderView.tsx` me-wire semuanya di Step 1. Pola modal yang mapan di repo: overlay `fixed inset-0 z-50 bg-black/40`, kartu `bg-white rounded-2xl border`, dipakai di `TransfersView`, `PackagesView`, `BundlingModal`, `StudentFormModal`. Batasan: file-size gate 400 baris (`StudentSearchStep.tsx` 274, `usePublicOrder.ts` 259 — keduanya tidak boleh membengkak), token visual `design-taste-frontend` (`#1877F2`, `rounded-2xl`/`rounded-xl`, `:active:scale-[0.98]`, label di atas input), dan modal harus `max-h-[90vh] overflow-y-auto` untuk keyboard mobile.

## Goals / Non-Goals

**Goals:**
- Mengganti transisi otomatis kosong->form dengan state eksplisit `pendingNoResultQuery` + modal tiga aksi.
- Menunda prefill nama sampai konfirmasi, mempertahankan query saat Batal/Ubah Kata Kunci, dan mengembalikan fokus ke input saat Ubah Kata Kunci.
- Menjaga pencarian berhasi (hasil > 0), jalur manual `Daftar Murid Baru`, dan flow verifikasi `verificationPending` tidak berubah.

**Non-Goals:**
- Saran fuzzy/typo otomatis ("mungkin maksud Anda..."), perubahan API backend/skema DB/migrasi D1, perubahan Step 2-4 atau tab retur, dan penambahan dependensi modal baru.

## Decisions

- **State baru `pendingNoResult: string | null` di `usePublicOrder` (dipilih atas boolean `showDialog`).**
  Rationale: membawa query yang di-echo ke modal tanpa membaca `searchQuery` yang bisa berubah saat modal terbuka; `null` = tertutup sehingga reset/pindah tab cukup set `null`. Alternatif boolean + baca `searchQuery` ditolak karena rawan echo basi.
- **`handleSearch` hanya set `pendingNoResult`, bukan `isNewStudentMode`.**
  Rationale: satu-satunya jalan masuk ke form dari hasil kosong adalah `confirmCreateNewStudent()` (set `isNewStudentMode(true)` + prefill + clear pending). Jalur manual tombol `Daftar Murid Baru` tetap memanggil `setIsNewStudentMode(true)` langsung tanpa pending. Alternatif mempertahankan auto-prefill ditolak karena melanggar spec "no silent prefill".
- **Komponen baru `src/components/portal/NoResultConfirmModal.tsx` (controlled, tanpa state internal).**
  Rationale: mematuhi file-size gate — `StudentSearchStep` tidak boleh menampung JSX modal tambahan; props `query`, `onConfirm`, `onEditKeyword`, `onCancel`. Render kondisional di `PublicOrderView` (atau di dalam `StudentSearchStep` sebagai sibling, diputuskan saat implementasi — prefer di `PublicOrderView` agar fokus-ref input mudah di-wire via ref/id stabil). Alternatif inline JSX ditolak karena menambah ~80-100 baris ke file yang hampir penuh. Alternatif portal/`createPortal` ditolak — tidak dibutuhkan, render kondisional cukup.
- **Fokus management via `id="portal-student-search-input"` + `document.getElementById(...).focus()`.**
  Rationale: paling sederhana lintas struktur komponen tanpa forwardRef; modal memanggil `onEditKeyword` yang menutup dialog lalu fokus. Alternatif `useRef` + prop drilling ditolak karena menambah plumbing untuk sekali pakai. Auto-focus tombol primary di modal disengaja TIDAK dilakukan agar tidak kepencet di HP; fokus awal ke tombol `Batal` atau container dialog.
- **Penutupan: X, backdrop click, dan Esc semuanya = `cancelNoResult()`.**
  Rationale: perilaku aman dan konsisten untuk ortu awam; tidak ada destructive action yang butuh proteksi ganda. Esc di-handle via `onKeyDown`/effect di modal.
- **Copy ID final:** judul `Siswa Tidak Ditemukan`, body `Data "[query]" belum terdaftar.` + `Pastikan ejaan NIS/nama sudah benar sebelum membuat data baru untuk menghindari data ganda.` Tombol `Batal` (ghost) / `Ubah Kata Kunci` (outline) / `Buat Siswa Baru` (primary `#1877F2`).

## Risks / Trade-offs

- [Risk] Ortu murid baru beneran butuh satu klik ekstra → Mitigasi: tombol `Buat Siswa Baru` dibuat primary paling menonjol; jalur manual tetap ada.
- [Risk] Fokus kembali gagal jika input di-unmount saat render ulang → Mitigasi: beri `id` stabil pada input search; panggil focus setelah state pending dibersihkan (requestAnimationFrame/next tick bila perlu); verifikasi manual di mobile.
- [Risk] Fokus trap modal terlalu sederhana untuk screen reader → Mitigasi: minimal `role="dialog" aria-modal="true" aria-labelledby`, Esc to close, dan tombol terjangkau keyboard; tidak perlu lib a11y penuh untuk modal 3 tombol.
- [Risk] `pendingNoResult` bocor saat reset/pindah tab → Mitigasi: bersihkan di `resetOrderFlow` dan handler tab switch bersama `errorMessage`.
- [Risk] File-size gate gagal bila modal ditulis inline → Mitigasi: file komponen baru terpisah + verifikasi `bun run check:file-size`.

## Migration Plan

Perubahan frontend-only, tanpa migrasi data. Deploy bersama build normal. Rollback: kembalikan `handleSearch` ke auto-`setIsNewStudentMode(true)` (satu blok) bila diperlukan; tidak ada state persisten yang perlu dibersihkan.

## Open Questions

- Posisi render modal final (di `PublicOrderView` vs di dalam `StudentSearchStep`) — diputuskan saat implementasi berdasarkan kemudahan wiring fokus; tidak mengubah spec.
