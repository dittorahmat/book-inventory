# 01: Robust Staff Sign-Out Flow & Explicit Redirect (UI & Client)

**What to build:**
Tombol Logout (Sign Out) di AppHeader menginisiasi alur keluar terverifikasi: memanggil `signOut` dengan handling callback dan fallback redirect ke `/login` sehingga sesi terhapus bersih dan antarmuka beralih ke halaman login staf tanpa macet.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tombol Sign Out di header memanggil handler `handleSignOut`
- [ ] Berhasil mengarahkan pengguna ke `/login` (tampilan LoginView) setelah sesi dihapus
- [ ] Fallback tangguh tetap membawa user ke `/login` jika request jaringan bermasalah
- [ ] Ditambahkan unit/regression test untuk AppHeader sign-out button
