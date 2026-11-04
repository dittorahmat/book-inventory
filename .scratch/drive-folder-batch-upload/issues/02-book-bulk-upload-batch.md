# 02: Integrasi Batch Folder Runner pada Modal Katalog Buku (BookBulkUploadModal)

**What to build:**
Integrate batch folder processing into `BookBulkUploadModal` so users can process all spreadsheet files in a Google Drive folder in one click with real-time progress. Aggregate all valid books into `BookImportPreview` and detect packages/BOM automatically.

**Blocked by:** 01-batch-runner-ui

**Status:** ready-for-agent

- [ ] Add "Proses Semua Berkas Folder" action to `BookBulkUploadModal` powered by `DriveFolderBatchRunner`.
- [ ] Concurrently or sequentially call `/api/books/parse-drive-url` per file, aggregating `validBooks`, `skippedRows`, and unique book counts.
- [ ] Keep file size under 400 lines adhering to gate §7.
- [ ] Add regression test in `BookBulkUploadModal.test.tsx` for batch runner folder processing.
