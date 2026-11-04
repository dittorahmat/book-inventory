# 03: Integrasi Batch Folder Runner pada Modal Intake Siswa (StudentBulkUploadModal)

**What to build:**
Integrate batch folder processing into `StudentBulkUploadModal` so users can process all student spreadsheets in a Google Drive folder in one click with real-time progress. Aggregate all valid students into `StudentImportPreview` before final submission to selected branch.

**Blocked by:** 01-batch-runner-ui

**Status:** ready-for-agent

- [ ] Add "Proses Semua Berkas Folder" action to `StudentBulkUploadModal` powered by `DriveFolderBatchRunner`.
- [ ] Sequentially call `/api/students/parse-drive-url` per file, aggregating `validStudents`, `skippedRows`, and unique NIS counts.
- [ ] Keep file size under 400 lines adhering to gate §7.
- [ ] Add regression test in `StudentBulkUploadModal.test.tsx` for batch runner folder processing.
