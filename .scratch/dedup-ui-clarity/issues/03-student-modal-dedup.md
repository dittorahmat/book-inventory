# 03: Penyajian Status Unik & Anti-Duplikat pada Modal Murid (StudentBulkUploadModal & StudentImportPreview)

**What to build:**
Update `StudentBulkUploadModal` and `StudentImportPreview` so the user sees the explicit count of unique students (by NIS) ready for import and the number of duplicate rows skipped.

**Blocked by:** 01-batch-runner-dedup

**Status:** completed

- [x] Track total raw lines read and unique students in `StudentBulkUploadModal`.
- [x] Display explicit badges in `StudentImportPreview`: "✓ Y siswa unik siap diimpor (Z duplikat NIS diabaikan)".
- [x] Keep file size under 400 lines adhering to gate §7.
- [x] Update unit tests in `StudentBulkUploadModal.test.tsx`.
