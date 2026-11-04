# 02: Smart Student Bulk Upload (Native Excel, Google Sheets, & Normalizer)

**What to build:**
Upgrade `StudentBulkUploadModal` dan alur intake siswa agar dapat menerima input file `.xlsx` / `.xlsm` secara langsung via library Excel klien (SheetJS `xlsx`), mendukung import link Google Sheets, serta memiliki normalizer cerdas untuk format kelas Al-Wildan (`<tingkat>.<tipe> <rombel>` -> `gradeLevel` & `curriculumType`). Baris khusus seperti `'Cuti'` otomatis dilewati dengan notifikasi di tabel preview.

**Blocked by:** 01: Database Reset & Purge Tooling (Lokal & Remote D1)

**Status:** ready-for-agent

- [ ] Parser native file `.xlsx`/`.xlsm` di frontend
- [ ] Dukungan link Google Sheets (download / convert CSV)
- [ ] Normalizer otomatis kelas Al-Wildan (tingkat 1-6, inter/mq/reguler)
- [ ] Preview baris valid & baris dilewati (Cuti dsb.)
- [ ] Verifikasi import 714 siswa dari file `DATA SISWA SD AL-WILDAN 1 TP. 2026-2027.xlsm`
