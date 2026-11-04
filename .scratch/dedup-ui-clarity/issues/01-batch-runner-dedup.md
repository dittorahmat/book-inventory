# 01: Transparansi Counter Anti-Duplikasi pada Runner Batch (DriveFolderBatchRunner)

**What to build:**
Update `DriveFolderBatchRunner` so it communicates both raw lines read across files and unique deduplicated items collected, displaying transparent text like "Total baris terbaca: X → Y item unik (Z duplikat otomatis diabaikan)".

**Blocked by:** None (can start immediately).

**Status:** completed

- [x] Support `rawItemsCount` and `uniqueItemsCount` in `DriveFolderBatchRunner`.
- [x] Display clear breakdown of raw lines vs deduplicated unique items.
- [x] Add unit test assertions in `DriveFolderBatchRunner.test.tsx`.
