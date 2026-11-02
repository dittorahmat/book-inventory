# 01: Default Semua Cabang untuk Admin Gudang & Pusat di Tab Data Siswa

**What to build:**
Mengalirkan `userRole` ke `StudentsView` dan menginisialisasi `selectedSchoolId` default ke `"all"` jika pengguna memiliki role global (`central_admin`, `warehouse_admin`, `warehouse_books_admin`, `warehouse_uniforms_admin`) atau jika lokasi aktif bertipe gudang (`isWarehouseLocation(activeSchool)`). Admin cabang sekolah tetap terisolasi ke lokasi penugasannya.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `StudentsView` menerima `userRole` opsional dan menentukan `isGlobalUser || isWh ? "all" : (activeSchool?.id ?? "all")`.
- [ ] `STAFF_TAB_RENDERERS.students` meneruskan `userRole={context.userRole}`.
- [ ] Unit regression test memverifikasi penentuan default school ID untuk staf gudang, central admin, dan branch admin.
