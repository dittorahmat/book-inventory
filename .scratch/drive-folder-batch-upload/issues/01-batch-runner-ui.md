# 01: Kanonik Batch Runner UI & State Orchestrator (DriveFolderBatchRunner)

**What to build:**
Reusable batch runner component and execution engine for sequential processing of files in a Google Drive folder. Displays an animated progress bar, percentage, current file indicator with spinner, cancel/retry options, and live item status indicators (success, warning, skipped) so users never feel the UI is hanging during multi-file operations.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Create `DriveFolderBatchRunner.tsx` with progress bar, active item indicator, and item status list.
- [ ] Provide sequential runner hook/callbacks with cancel capability and graceful skip on individual file errors.
- [ ] Add unit test in `DriveFolderBatchRunner.test.tsx` verifying progress calculation and status transitions.
