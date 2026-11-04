# 02: Penyajian Status Unik & Anti-Duplikat pada Modal Katalog Buku (BookBulkUploadModal & BookImportPreview)

**What to build:**
Update `BookBulkUploadModal` and `BookImportPreview` so the user sees the explicit count of unique book titles ready for import and the number of cross-file duplicates skipped.

**Blocked by:** 01-batch-runner-dedup

**Status:** completed

- [x] Track total raw lines read and unique titles in `BookBulkUploadModal`.
- [x] Display explicit badges in `BookImportPreview`: "✓ Y judul buku unik siap diimpor (Z duplikat diabaikan)".
- [x] Keep file size under 400 lines adhering to gate §7.
- [x] Update unit tests in `BookBulkUploadModal.test.tsx`.
